import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from './db';
import { uploads, companies, journeys } from './schema';
import { eq, desc } from 'drizzle-orm';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const { ZipArchive }: any = require('archiver');


const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || '123456';
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_storage_key';

const app = express();
const port = process.env.PORT || 3001;

app.enable('trust proxy');
app.use(cors());
app.use(express.json());

const storageDir = path.join(process.cwd(), 'storage');
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, storageDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = crypto.randomUUID();
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(originalName);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

const upload = multer({ storage });

// Middleware de Autenticação
function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    res.status(401).json({ error: 'Token não fornecido' });
    return;
  }
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

// Rota de Upload
app.post('/api/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { file } = req;
    const { journeyId, companyId, clientId, uploaderId, uploaderType, category } = req.body;

    if (!file) {
      res.status(400).json({ error: 'Nenhum arquivo enviado' });
      return;
    }

    const decodedOriginalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    
    // Se STORAGE_PUBLIC_URL for definido no ambiente, usa ele como base para a URL do arquivo
    const baseUrl = process.env.STORAGE_PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
    const fileUrl = `${baseUrl.replace(/\/$/, '')}/api/download/${file.filename}`;

    const [newUpload] = await db.insert(uploads).values({
      journeyId: journeyId || null,
      companyId: companyId || null,
      clientId: clientId || null,
      uploaderId: uploaderId || null,
      uploaderType: uploaderType || null,
      category: category || 'general',
      originalName: decodedOriginalName,
      uniqueName: file.filename,
      fileUrl: fileUrl,
    }).returning();

    res.json({ success: true, upload: newUpload });
  } catch (error: any) {
    console.error('Erro no upload:', error);
    res.status(500).json({ error: 'Erro interno ao salvar arquivo', details: error.message || String(error) });
  }
});

// Rota de Download
app.get('/api/download/:filename', async (req: Request, res: Response) => {
  try {
    const filename = Array.isArray(req.params.filename) ? req.params.filename[0] : req.params.filename;
    const filePath = path.join(storageDir, filename);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Arquivo não encontrado' });
      return;
    }

    const uploadRecord = await db.select().from(uploads).where(eq(uploads.uniqueName, filename)).limit(1);

    if (uploadRecord.length > 0 && uploadRecord[0].originalName) {
      res.download(filePath, uploadRecord[0].originalName);
    } else {
      res.download(filePath);
    }
  } catch (error) {
    console.error('Erro no download:', error);
    res.status(500).json({ error: 'Erro interno ao baixar arquivo' });
  }
});

// Rota de Deleção de Arquivo sem auth (usada pelo proxy)
app.delete('/api/upload/:uniqueName', async (req: Request, res: Response) => {
  try {
    const uniqueName = Array.isArray(req.params.uniqueName) ? req.params.uniqueName[0] : req.params.uniqueName;

    const [uploadRecord] = await db.select().from(uploads).where(eq(uploads.uniqueName, uniqueName)).limit(1);
    if (!uploadRecord) {
      res.status(404).json({ error: 'Arquivo não encontrado' });
      return;
    }

    // Limpar referências na jornada se houver
    if (uploadRecord.journeyId) {
      const [journey] = await db.select().from(journeys).where(eq(journeys.id, uploadRecord.journeyId)).limit(1);
      if (journey) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: any = {};

        if (Array.isArray(journey.documents)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          updateData.documents = journey.documents.filter((d: any) => d && typeof d === 'object' && d.uniqueName !== uploadRecord.uniqueName);
        }
        if (Array.isArray(journey.aepFiles)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          updateData.aepFiles = journey.aepFiles.filter((d: any) => d && typeof d === 'object' && d.uniqueName !== uploadRecord.uniqueName);
        }
        if (uploadRecord.uniqueName && journey.reportUrl?.includes(uploadRecord.uniqueName)) updateData.reportUrl = null;
        if (uploadRecord.uniqueName && journey.riskMapUrl?.includes(uploadRecord.uniqueName)) updateData.riskMapUrl = null;
        if (uploadRecord.uniqueName && journey.actionPlanUrl?.includes(uploadRecord.uniqueName)) updateData.actionPlanUrl = null;

        if (Object.keys(updateData).length > 0) {
          await db.update(journeys).set(updateData).where(eq(journeys.id, journey.id));
        }
      }
    }

    // Deletar o arquivo físico
    const filePath = path.join(storageDir, uploadRecord.uniqueName ?? '');
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await db.delete(uploads).where(eq(uploads.id, uploadRecord.id));

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao deletar arquivo (proxy):', error);
    res.status(500).json({ error: 'Erro interno ao deletar arquivo' });
  }
});

// Rota para listar arquivos
app.get('/api/uploads', async (_req: Request, res: Response) => {
  try {
    const results = await db
      .select({
        id: uploads.id,
        category: uploads.category,
        originalName: uploads.originalName,
        uniqueName: uploads.uniqueName,
        fileUrl: uploads.fileUrl,
        createdAt: uploads.createdAt,
        companyName: companies.name,
        journeyStatus: journeys.status,
        serviceType: journeys.serviceType,
      })
      .from(uploads)
      .leftJoin(companies, eq(uploads.companyId, companies.id))
      .leftJoin(journeys, eq(uploads.journeyId, journeys.id))
      .orderBy(desc(uploads.createdAt));

    res.json(results);
  } catch (error) {
    console.error('Erro ao listar uploads:', error);
    res.status(500).json({ error: 'Erro interno ao listar arquivos' });
  }
});

// Rota de Login
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Credenciais inválidas' });
  }
});

// Rota de Estatísticas (Dashboard)
app.get('/api/stats', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const allUploads = await db.select().from(uploads);

    let totalSizeBytes = 0;
    if (fs.existsSync(storageDir)) {
      const files = fs.readdirSync(storageDir);
      for (const file of files) {
        const stats = fs.statSync(path.join(storageDir, file));
        totalSizeBytes += stats.size;
      }
    }

    const categoriesCount = allUploads.reduce((acc, curr) => {
      const cat = curr.category || 'general';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    res.json({
      totalFiles: allUploads.length,
      totalSizeMb: (totalSizeBytes / (1024 * 1024)).toFixed(2),
      categories: categoriesCount,
    });
  } catch (error) {
    console.error('Erro ao buscar stats:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// Rota de Deleção de Arquivo
app.delete('/api/uploads/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const [uploadRecord] = await db.select().from(uploads).where(eq(uploads.id, id)).limit(1);
    if (!uploadRecord) {
      res.status(404).json({ error: 'Arquivo não encontrado' });
      return;
    }

    // Limpar referências na jornada se houver
    if (uploadRecord.journeyId) {
      const [journey] = await db.select().from(journeys).where(eq(journeys.id, uploadRecord.journeyId)).limit(1);
      if (journey) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: any = {};

        if (Array.isArray(journey.documents)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          updateData.documents = journey.documents.filter((d: any) => d && typeof d === 'object' && d.uniqueName !== uploadRecord.uniqueName);
        }
        if (Array.isArray(journey.aepFiles)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          updateData.aepFiles = journey.aepFiles.filter((d: any) => d && typeof d === 'object' && d.uniqueName !== uploadRecord.uniqueName);
        }
        if (uploadRecord.uniqueName && journey.reportUrl?.includes(uploadRecord.uniqueName)) updateData.reportUrl = null;
        if (uploadRecord.uniqueName && journey.riskMapUrl?.includes(uploadRecord.uniqueName)) updateData.riskMapUrl = null;
        if (uploadRecord.uniqueName && journey.actionPlanUrl?.includes(uploadRecord.uniqueName)) updateData.actionPlanUrl = null;

        if (Object.keys(updateData).length > 0) {
          await db.update(journeys).set(updateData).where(eq(journeys.id, journey.id));
        }
      }
    }

    // Deletar o arquivo físico
    const filePath = path.join(storageDir, uploadRecord.uniqueName ?? '');
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await db.delete(uploads).where(eq(uploads.id, id));

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao deletar arquivo:', error);
    res.status(500).json({ error: 'Erro interno ao deletar arquivo' });
  }
});

// Rota de Backup
app.get('/api/backup', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const archive = new ZipArchive({ zlib: { level: 9 } });

    res.attachment('viapeople_storage_backup.zip');
    archive.pipe(res);

    if (fs.existsSync(storageDir)) {
      archive.directory(storageDir, 'storage');
    }

    const allUploads = await db.select().from(uploads);
    archive.append(JSON.stringify(allUploads, null, 2), { name: 'database_dump_uploads.json' });

    archive.on('error', (err: Error) => {
      throw err;
    });

    await archive.finalize();
  } catch (error) {
    console.error('Erro ao gerar backup:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Erro interno ao gerar backup' });
    }
  }
});

// Servir arquivos estáticos do frontend em produção
const clientDistDir = path.join(process.cwd(), 'client', 'dist');
if (fs.existsSync(clientDistDir)) {
  app.use(express.static(clientDistDir));
  app.get('*splat', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(clientDistDir, 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`Viapeople Storage API rodando na porta ${port}`);
});