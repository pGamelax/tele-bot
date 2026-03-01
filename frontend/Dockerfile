# Dockerfile para Frontend Next.js com Bun
FROM oven/bun:1 AS base

# Instalar dependências
FROM base AS deps
WORKDIR /app
COPY frontend/package.json ./
# Copiar lockfile se existir
COPY frontend/bun.lockb* ./
RUN bun install --frozen-lockfile

# Build
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY frontend ./
# Variáveis de ambiente são necessárias no build time para Next.js
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_BETTER_AUTH_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_BETTER_AUTH_URL=$NEXT_PUBLIC_BETTER_AUTH_URL
RUN bun run build

# Produção (Bun tem compatibilidade com Node.js, pode executar server.js)
FROM base AS production
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

# Copiar apenas arquivos necessários
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

# Expor porta
EXPOSE 3001

# Health check (Bun pode executar código Node.js)
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:3001').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Iniciar servidor Next.js com Bun (Bun tem compatibilidade com Node.js)
CMD ["bun", "run", "server.js"]
