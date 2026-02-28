# Guia de Deploy no Coolify

Este guia explica como fazer deploy do Tele Bot no Coolify.

## 📋 Pré-requisitos

- Conta no Coolify configurada
- Acesso a um servidor VPS
- Banco de dados PostgreSQL (pode ser criado no Coolify ou externo)

## 🚀 Passo a Passo

### 1. Preparar o Repositório

Certifique-se de que o código está no GitHub/GitLab/Bitbucket.

### 2. Criar Aplicações no Coolify

Você precisará criar **2 aplicações separadas**:
- **Backend** (API)
- **Frontend** (Interface Web)

### 3. Configurar Backend

1. **Criar Nova Aplicação** no Coolify
2. **Tipo**: Docker Compose ou Dockerfile
3. **Repositório**: Seu repositório Git
4. **Dockerfile Path**: `backend/Dockerfile`
5. **Context**: Raiz do repositório

#### Variáveis de Ambiente do Backend

Adicione as seguintes variáveis no Coolify:

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/database?schema=public

# Better Auth
BETTER_AUTH_SECRET=your-secret-key-here-change-in-production
BETTER_AUTH_URL=https://api.seudominio.com
FRONTEND_URL=https://seudominio.com

# API Configuration
PORT=3000
NODE_ENV=production
API_URL=https://api.seudominio.com

# SyncPay
SYNCPAY_API_URL=https://api.syncpay.com.br
WEBHOOK_URL=https://api.seudominio.com

# Facebook (opcional)
FACEBOOK_EVENT_SOURCE_URL=https://telegram.org
```

**Importante:**
- `BETTER_AUTH_URL` e `API_URL` devem ser a URL pública do seu backend
- `FRONTEND_URL` deve ser a URL pública do seu frontend
- `WEBHOOK_URL` deve ser a URL pública do backend (para receber webhooks do SyncPay)
- `BETTER_AUTH_SECRET` deve ser uma string aleatória e segura (use um gerador)

### 4. Configurar Frontend

1. **Criar Nova Aplicação** no Coolify
2. **Tipo**: Docker Compose ou Dockerfile
3. **Repositório**: Seu repositório Git
4. **Dockerfile Path**: `frontend/Dockerfile`
5. **Context**: Raiz do repositório

#### Variáveis de Ambiente do Frontend

Adicione as seguintes variáveis no Coolify:

```env
VITE_API_URL=https://api.seudominio.com
```

**Importante:**
- `VITE_API_URL` deve ser a URL pública do seu backend
- Esta variável é usada em build time, então precisa estar configurada antes do build

### 5. Configurar Banco de Dados

#### Opção 1: Banco no Coolify

1. Crie um serviço PostgreSQL no Coolify
2. Anote as credenciais
3. Use a `DATABASE_URL` fornecida pelo Coolify

#### Opção 2: Banco Externo

1. Configure seu banco PostgreSQL externo
2. Use a `DATABASE_URL` completa no formato:
   ```
   postgresql://user:password@host:5432/database?schema=public
   ```

### 6. Executar Migrações

Após o primeiro deploy do backend, você precisa executar as migrações do Prisma:

1. Acesse o terminal do container do backend no Coolify
2. Execute:
   ```bash
   bunx prisma db push
   ```

Ou adicione um script de inicialização no Dockerfile (já incluído).

### 7. Configurar Domínios

No Coolify, configure os domínios para:
- **Backend**: `api.seudominio.com` (ou o domínio que preferir)
- **Frontend**: `seudominio.com` (ou o domínio que preferir)

### 8. Verificar Deploy

1. Acesse o frontend: `https://seudominio.com`
2. Crie uma conta
3. Configure um bot
4. Teste o funcionamento

## 🔧 Troubleshooting

### Erro de Conexão com Banco

- Verifique se a `DATABASE_URL` está correta
- Verifique se o banco está acessível do container
- Verifique se as credenciais estão corretas

### Erro de CORS

- Verifique se `FRONTEND_URL` no backend está correto
- Verifique se `VITE_API_URL` no frontend está correto

### Webhook não funciona

- Verifique se `WEBHOOK_URL` está configurado corretamente
- Verifique se o domínio do backend está acessível publicamente
- Teste acessando: `https://api.seudominio.com/api/webhooks/syncpay`

### Frontend não carrega

- Verifique se o build foi feito corretamente
- Verifique os logs do container
- Verifique se `VITE_API_URL` foi definido antes do build

## 📝 Notas Importantes

1. **Variáveis de Ambiente**: As variáveis do frontend (VITE_*) são incorporadas no build. Se você mudar, precisa fazer rebuild.

2. **Banco de Dados**: O Prisma precisa gerar o cliente antes de iniciar. Isso já está no Dockerfile.

3. **Uploads**: Os uploads são salvos no diretório `uploads` do container. Considere usar um volume persistente ou um serviço de storage (S3, etc).

4. **HTTPS**: Certifique-se de usar HTTPS em produção. O Coolify geralmente configura isso automaticamente com Let's Encrypt.

5. **Secrets**: Nunca commite arquivos `.env` no repositório. Use apenas as variáveis de ambiente do Coolify.

## 🔄 Atualizações

Para atualizar a aplicação:
1. Faça push das alterações para o repositório
2. O Coolify detectará automaticamente e fará rebuild
3. Ou force um rebuild manualmente no painel do Coolify
