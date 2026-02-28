# Dockerfile para Backend
FROM oven/bun:1 AS base
WORKDIR /app

# Instalar dependências
FROM base AS deps
WORKDIR /app/backend
COPY backend/package.json ./
# Copiar lockfile se existir
COPY backend/bun.lockb* ./
RUN bun install --frozen-lockfile

# Build
FROM base AS build
WORKDIR /app/backend
COPY --from=deps /app/backend/node_modules ./node_modules
COPY backend/package.json ./
COPY backend/prisma ./prisma
COPY backend/src ./src
RUN bun run build

# Produção
FROM base AS production
WORKDIR /app/backend

# Copiar apenas arquivos necessários
COPY --from=deps /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/build ./build
COPY --from=build /app/backend/prisma ./prisma
COPY --from=build /app/backend/src ./src
COPY --from=build /app/backend/package.json ./

# Criar diretório de uploads
RUN mkdir -p uploads

# Gerar Prisma Client
RUN bunx prisma generate

# Copiar script de inicialização
COPY backend/start.sh ./start.sh
RUN chmod +x ./start.sh

# Expor porta
EXPOSE 3000

# Health check (usa PORT do ambiente ou 3000)
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD sh -c "port=\${PORT:-3000} && bun -e \"const p = process.env.PORT || '3000'; fetch('http://localhost:' + p).then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))\""

# Comando de inicialização
CMD ["./start.sh"]
