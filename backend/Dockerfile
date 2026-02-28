# Dockerfile para Backend
FROM oven/bun:1 AS base
WORKDIR /app

# Instalar dependências
FROM base AS deps
COPY package.json bun.lockb* ./
COPY backend/package.json ./backend/
RUN bun install --frozen-lockfile

# Build
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY backend ./backend
WORKDIR /app/backend
RUN bun run build

# Produção
FROM base AS production
WORKDIR /app/backend

# Copiar apenas arquivos necessários
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/backend/build ./build
COPY --from=build /app/backend/prisma ./prisma
COPY --from=build /app/backend/src ./src
COPY --from=build /app/backend/package.json ./

# Criar diretório de uploads
RUN mkdir -p uploads

# Gerar Prisma Client
RUN bunx prisma generate

# Expor porta
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000/').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Comando de inicialização
CMD ["bun", "run", "src/index.ts"]
