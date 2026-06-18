# Guia de Deploy no Easypanel (VPS) - Viapeople Storage API

Este guia fornece o passo a passo detalhado para implantar o serviço **Viapeople Storage API** na sua VPS utilizando o **Easypanel**.

O serviço engloba tanto a API em Node.js quanto o painel administrativo em React (Vite) servido de forma estática pelo Express em um único container.

---

## 🛠️ Pré-requisitos

1. **VPS** configurada com **Easypanel** ativo.
2. **Repositório Git** criado no GitHub contendo o código desta pasta (`viapeople-storage-api`).
3. **Banco de dados PostgreSQL** ativo (o mesmo utilizado pelo `psyche-care-hub`).

---

## 📦 Passo 1: Preparar o Repositório no GitHub

Como este diretório está separado do projeto principal, você precisará inicializar um repositório Git e enviá-lo ao GitHub:

1. Abra o terminal na pasta `viapeople-storage-api`:
   ```bash
   git init
   git branch -M main
   ```
2. Crie um arquivo `.gitignore` (caso não exista) com:
   ```
   node_modules
   client/node_modules
   client/dist
   storage
   .env
   ```
3. Adicione e faça o commit dos arquivos:
   ```bash
   git add .
   git commit -m "feat: setup docker deployment files"
   ```
4. Crie um repositório no seu GitHub (ex: `noaitech/viapeople-storage-api`) e vincule-o:
   ```bash
   git remote add origin git@github.com:USUARIO/viapeople-storage-api.git
   git push -u origin main
   ```

---

## 🚀 Passo 2: Criar a Aplicação no Easypanel

1. Acesse o painel do seu **Easypanel**.
2. Selecione o seu **Projeto** (ou crie um novo projeto chamado `viapeople`).
3. Clique em **+ Service** (ou Criar Serviço) e escolha **App**.
4. Defina um nome para o serviço, por exemplo: `storage-api`.

---

## ⚙️ Passo 3: Configurar a Fonte de Build (Source)

Na aba **Source** (Origem/Fonte) da aplicação configurada no Easypanel:

1. **Provider**: Escolha **GitHub**.
2. **Repository**: Insira o caminho do seu repositório (ex: `USUARIO/viapeople-storage-api`).
3. **Branch**: `main`.
4. **Build Method**: Escolha **Docker**.
5. **Dockerfile Path**: Preencha com `Dockerfile` (caso não seja o padrão).

---

## 💾 Passo 4: Configurar o Armazenamento Persistente (Storage/Volumes)

> [!IMPORTANT]
> Sem a configuração de um Volume persistente, todos os arquivos enviados pelos usuários serão deletados permanentemente sempre que o container for reiniciado ou atualizado!

Para garantir que os uploads fiquem salvos permanentemente na VPS:

1. No Easypanel, vá na aba **Storage** (ou Volumes) do serviço `storage-api`.
2. Clique em **Add Volume** (Adicionar Volume).
3. Preencha as configurações:
   - **Host Path**: `/var/lib/easypanel/volumes/viapeople-storage` (ou deixe em branco para o Easypanel gerar um caminho automático persistente).
   - **Mount Path**: `/app/storage` (Este caminho **DEVE** ser exatamente este, pois coincide com a pasta interna de uploads configurada no Dockerfile e no backend).
4. Clique em **Save** (Salvar).

---

## 🔑 Passo 5: Configurar Variáveis de Ambiente (Env)

Acesse a aba **Environment** (Variáveis de Ambiente) e adicione as seguintes chaves:

| Nome | Valor | Descrição |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Modo de execução do Node |
| `PORT` | `3001` | Porta interna que a aplicação escutará |
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db` | String de conexão com o banco do Psyche Care Hub |

> [!TIP]
> Use a mesma string de conexão `DATABASE_URL` do seu ambiente de produção do Psyche Care Hub para que os uploads fiquem registrados na mesma base de dados.

---

## 🌐 Passo 6: Configurar Domínio e SSL (HTTPS)

Na aba **Domains** (Domínios) do serviço no Easypanel:

1. Adicione o domínio ou subdomínio que deseja usar (ex: `storage.suadominio.com.br`).
2. Defina a **Porta** para `3001` (porta exposta no Dockerfile e na variável de ambiente).
3. O Easypanel configurará automaticamente o certificado SSL (HTTPS) via Let's Encrypt.

---

## 🔗 Passo 7: Integrar com a Aplicação Principal (Psyche Care Hub)

Após colocar a API de Storage no ar e ter o domínio HTTPS configurado (ex: `https://storage.suadominio.com.br`):

1. Vá nas configurações da aplicação **Psyche Care Hub** no Easypanel.
2. Acesse a aba **Environment** (Variáveis de Ambiente).
3. Adicione ou atualize a seguinte variável de ambiente:
   - **Chave**: `STORAGE_API_URL`
   - **Valor**: `https://storage.suadominio.com.br/api/upload` (substitua pelo seu domínio configurado).
4. Salve e reinicie o serviço do Psyche Care Hub.

Agora, todos os uploads feitos no Psyche Care Hub serão encaminhados automaticamente para a API de Storage na VPS, salvando os arquivos no volume persistente e registrando os metadados no banco de dados compartilhado.
