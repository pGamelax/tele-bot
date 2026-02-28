# Guia de Configuração - Tele Bot

## 📋 Pré-requisitos

- [Bun](https://bun.sh) instalado (versão 1.0 ou superior)
- Docker e Docker Compose instalados
- Conta na Pushinpay com token de API

## 🚀 Instalação

### 1. Instalar Dependências

```bash
bun install
```

### 2. Configurar Banco de Dados

Inicie o PostgreSQL com Docker:

```bash
docker-compose up -d
```

### 3. Configurar Variáveis de Ambiente

#### Backend

Copie o arquivo de exemplo e configure:

```bash
cp backend/env.example backend/.env
```

Edite `backend/.env`:

```env
DATABASE_URL="postgresql://telebot:telebot123@localhost:5432/telebot?schema=public"
BETTER_AUTH_SECRET="sua-chave-secreta-aqui"
BETTER_AUTH_URL="http://localhost:3000"
PORT=3000
NODE_ENV=development
PUSHINPAY_API_URL="https://api.pushinpay.com.br"
```

#### Frontend

O frontend usa proxy para a API, não precisa de `.env` para desenvolvimento.

### 4. Gerar Cliente Prisma

```bash
bun run db:generate
```

### 5. Executar Migrações

```bash
bun run db:migrate
```

**Nota**: No Windows com Bun, é necessário gerar o Prisma Client **antes** de executar migrações. Você também pode usar o script combinado:

```bash
bun run db:migrate:generate
```

### 6. Iniciar Desenvolvimento

```bash
# Terminal 1 - Backend
cd backend
bun run dev

# Terminal 2 - Frontend
cd frontend
bun run dev
```

Acesse:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- Swagger: http://localhost:3000/swagger

## 🤖 Configurando um Bot

### 1. Criar Conta de Usuário

Primeiro, você precisa criar uma conta. Use a rota de registro:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "seu@email.com",
    "password": "sua-senha",
    "name": "Seu Nome"
  }'
```

Ou faça login no dashboard e crie a conta pela interface.

### 2. Obter Token do Telegram

1. Fale com [@BotFather](https://t.me/botfather) no Telegram
2. Use `/newbot` para criar um novo bot
3. Copie o token fornecido

### 3. Obter Token da Pushinpay

1. Acesse sua conta na Pushinpay
2. Vá em Configurações > API
3. Copie o token de API

### 4. Configurar Bot no Dashboard

1. Acesse http://localhost:5173
2. Faça login
3. Clique em "Novo Bot"
4. Preencha:
   - Nome do bot
   - Token do Telegram
   - Token da Pushinpay
   - URL da imagem (opcional)
   - Caption da imagem (opcional)
   - Botões de pagamento (texto e valor em reais, ex: 12,90)

5. Clique em "Criar Bot"

O bot será iniciado automaticamente!

## 📝 Notas Importantes

### Valores em Centavos

A Pushinpay usa **centavos** nos valores. O sistema converte automaticamente:
- Você digita: `12,90` (R$ 12,90)
- Sistema envia: `1290` (centavos)

### Imagens

Para a imagem do `/start`, você pode usar:
- URL direta de uma imagem (https://...)
- O bot do Telegram suporta JPG, PNG, GIF

### Botões de Pagamento

- Cada botão precisa de um texto e um valor
- O valor é exibido automaticamente no formato R$ X,XX
- Mínimo de 1 botão, sem máximo

## 🐛 Troubleshooting

### Bot não inicia

- Verifique se o token do Telegram está correto
- Verifique os logs do backend
- Certifique-se de que o bot está ativo no dashboard

### Erro ao gerar PIX

- Verifique se o token da Pushinpay está correto
- Verifique se a API da Pushinpay está acessível
- Confira os logs do backend para mais detalhes

### Erro de conexão com banco

- Verifique se o Docker está rodando: `docker ps`
- Verifique se o PostgreSQL está saudável: `docker-compose ps`
- Verifique a `DATABASE_URL` no `.env`

## 🚢 Deploy em Produção

Veja o arquivo `DOCKER.md` para instruções detalhadas sobre deploy em produção com múltiplos bots.
