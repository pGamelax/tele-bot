# Dockerfile para Frontend Next.js
FROM node:20-alpine AS base

# Instalar dependências
FROM base AS deps
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

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
RUN npm run build

# Produção
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

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => process.exit(1))"

# Iniciar servidor Next.js
CMD ["node", "server.js"]
