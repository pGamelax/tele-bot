# 🚀 Guia de Deploy - Tele Bot

Este projeto está configurado para deploy no Coolify ou qualquer plataforma que suporte Docker.

## 📦 Estrutura

- **Backend**: API em Elysia.js com Bun
- **Frontend**: React + Vite + TanStack Router
- **Banco de Dados**: PostgreSQL (Prisma ORM)

## 🐳 Dockerfiles

### Backend (`backend/Dockerfile`)
- Base: `oven/bun:1`
- Porta: `3000`
- Health check incluído

### Frontend (`frontend/Dockerfile`)
- Build: Node.js 20
- Produção: Nginx Alpine
- Porta: `80`

## 🔧 Variáveis de Ambiente

### Backend

Crie um arquivo `.env` no diretório `backend/` ou configure no Coolify:

```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/database?schema=public"

# Better Auth
BETTER_AUTH_SECRET="your-secret-key-here-change-in-production"
BETTER_AUTH_URL="https://api.seudominio.com"
FRONTEND_URL="https://seudominio.com"

# API Configuration
PORT=3000
NODE_ENV=production
API_URL="https://api.seudominio.com"

# SyncPay
SYNCPAY_API_URL="https://api.syncpay.com.br"
WEBHOOK_URL="https://api.seudominio.com"

# Facebook (opcional)
FACEBOOK_EVENT_SOURCE_URL="https://telegram.org"
```

### Frontend

Configure no Coolify (variáveis de build):

```env
VITE_API_URL=https://api.seudominio.com
```

**Importante**: Variáveis `VITE_*` são incorporadas no build. Se mudar, precisa fazer rebuild.

## 📝 Checklist de Deploy

- [ ] Banco de dados PostgreSQL configurado
- [ ] Variáveis de ambiente do backend configuradas
- [ ] Variáveis de ambiente do frontend configuradas (build time)
- [ ] Domínios configurados (backend e frontend)
- [ ] SSL/HTTPS configurado
- [ ] Migrações do banco executadas (`bunx prisma db push`)
- [ ] Teste de criação de conta
- [ ] Teste de criação de bot
- [ ] Teste de webhook do SyncPay

## 🔍 Troubleshooting

### Erro: "Cannot connect to database"
- Verifique `DATABASE_URL`
- Verifique se o banco está acessível do container

### Erro: CORS
- Verifique `FRONTEND_URL` no backend
- Verifique `VITE_API_URL` no frontend

### Webhook não funciona
- Verifique `WEBHOOK_URL` ou `BETTER_AUTH_URL`
- Teste acessando: `https://api.seudominio.com/api/webhooks/syncpay`

### Frontend não carrega API
- Verifique se `VITE_API_URL` foi definido antes do build
- Faça rebuild do frontend

## 📚 Documentação Adicional

- [COOLIFY_DEPLOY.md](./COOLIFY_DEPLOY.md) - Guia detalhado para Coolify
- [SETUP.md](./SETUP.md) - Guia de desenvolvimento local
