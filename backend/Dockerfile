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
COPY --from=build /app/backend/scripts ./scripts
COPY --from=build /app/backend/package.json ./

# Criar diretório de uploads e definir variável de ambiente
RUN mkdir -p uploads
ENV UPLOAD_DIR=/app/backend/uploads

# Gerar Prisma Client
RUN bunx --bun prisma generate

# Copiar scripts
COPY backend/start.sh ./start.sh
COPY backend/healthcheck.sh ./healthcheck.sh
RUN chmod +x ./start.sh ./healthcheck.sh

# Variáveis de ambiente padrão
ENV NODE_ENV=production
ENV PORT=3000

# Expor porta
EXPOSE 3000

# Health check (usa PORT do ambiente ou 3000)
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD ["./healthcheck.sh"]

# Comando de inicialização
CMD ["./start.sh"]
