import { useState, useEffect } from 'react';
import { Download, Trash2, HardDrive, FileText, Activity, LogOut } from 'lucide-react';

type UploadRecord = {
  id: string;
  category: string;
  originalName: string;
  uniqueName: string;
  fileUrl: string;
  createdAt: string;
  companyName: string | null;
  journeyStatus: string | null;
  serviceType: string | null;
};

type Stats = {
  totalFiles: number;
  totalSizeMb: string;
  categories: Record<string, number>;
};

export default function Dashboard({ setAuth }: { setAuth: (val: boolean) => void }) {
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const handleLogout = () => {
    localStorage.removeItem('storage_token');
    setAuth(false);
  };

  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('storage_token');
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      handleLogout();
    }
    return res;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [uploadsRes, statsRes] = await Promise.all([
        fetchWithAuth('/api/uploads'),
        fetchWithAuth('/api/stats')
      ]);
      
      if (uploadsRes.ok) setUploads(await uploadsRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // loadData is handled in useEffect


  const handleDownload = (uniqueName: string) => {
    window.location.assign(`/api/download/${uniqueName}`);
  };

  // handleBackup removed since triggerBackupDownload is used instead


  const triggerBackupDownload = async () => {
    try {
      const res = await fetchWithAuth('/api/backup');
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'viapeople_storage_backup.zip';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Erro ao gerar backup');
      }
    } catch (err: unknown) {
      console.error(err);
      alert('Erro de rede ao gerar backup');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Tem certeza que deseja deletar o arquivo "${name}" permanentemente? Isso removerá o acesso em Ordens de Serviço ligadas a ele.`)) {
      try {
        const res = await fetchWithAuth(`/api/uploads/${id}`, { method: 'DELETE' });
        if (res.ok) {
          loadData();
        } else {
          alert('Erro ao deletar arquivo');
        }
      } catch (err: unknown) {
        console.error(err);
        alert('Erro de rede ao deletar arquivo');
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const formatCategory = (category: string) => {
    const categories: Record<string, string> = {
      planilha_colaboradores: 'Planilha Colab.',
      documentacao_aep: 'Docs AEP',
      arquivo_anexo: 'Anexo Genérico',
    };
    return categories[category] || category;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <HardDrive className="h-6 w-6 text-indigo-600" />
              <h1 className="text-xl font-bold text-slate-900">Storage Hub</h1>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={triggerBackupDownload}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
              >
                <Download className="h-4 w-4" />
                Gerar Backup
              </button>
              <button 
                onClick={handleLogout}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center gap-4">
            <div className="bg-blue-50 p-3 rounded-lg">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total de Arquivos</p>
              <p className="text-2xl font-bold text-slate-900">{stats?.totalFiles || 0}</p>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center gap-4">
            <div className="bg-indigo-50 p-3 rounded-lg">
              <HardDrive className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Espaço Utilizado</p>
              <p className="text-2xl font-bold text-slate-900">{stats?.totalSizeMb || '0.00'} MB</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center gap-4">
            <div className="bg-emerald-50 p-3 rounded-lg">
              <Activity className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Status da API</p>
              <p className="text-2xl font-bold text-emerald-600">Online</p>
            </div>
          </div>
        </div>

        {/* Table Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
            <h2 className="text-lg font-semibold text-slate-900">Arquivos Hospedados</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider font-semibold text-slate-500">
                  <th className="p-4 pl-6">Arquivo</th>
                  <th className="p-4">Categoria</th>
                  <th className="p-4">Empresa / Origem</th>
                  <th className="p-4">OS (Status)</th>
                  <th className="p-4">Data</th>
                  <th className="p-4 pr-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="text-sm text-slate-600 divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">Carregando dados...</td>
                  </tr>
                ) : uploads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">Nenhum arquivo encontrado.</td>
                  </tr>
                ) : (
                  uploads.map((upload) => (
                    <tr key={upload.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 pl-6">
                        <div className="font-medium text-slate-900 truncate max-w-[200px]" title={upload.originalName}>
                          {upload.originalName}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
                          {formatCategory(upload.category)}
                        </span>
                      </td>
                      <td className="p-4 truncate max-w-[150px]" title={upload.companyName || '-'}>
                        {upload.companyName || '-'}
                      </td>
                      <td className="p-4">
                        <div className="truncate max-w-[150px]">{upload.serviceType || '-'}</div>
                        {upload.journeyStatus && (
                          <div className="text-xs text-slate-400 mt-0.5">{upload.journeyStatus}</div>
                        )}
                      </td>
                      <td className="p-4 whitespace-nowrap text-xs">
                        {formatDate(upload.createdAt)}
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleDownload(upload.uniqueName)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                            title="Baixar Arquivo"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(upload.id, upload.originalName)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Deletar Arquivo"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
