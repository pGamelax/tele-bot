# Dockerfile para Frontend
FROM node:20-alpine AS base

# Instalar dependências
FROM base AS deps
WORKDIR /app
COPY frontend/package.json ./
RUN npm install

# Build
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY frontend ./
# Variáveis de ambiente são necessárias no build time para Vite
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Produção - servir arquivos estáticos com serve
FROM node:20-alpine AS production
WORKDIR /app

# Instalar serve globalmente
RUN npm install -g serve

# Copiar arquivos buildados
COPY --from=build /app/dist ./dist

# Expor porta (Coolify mapeia automaticamente)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/ || exit 1

# Servir arquivos estáticos
CMD ["serve", "-s", "dist", "-l", "3000"]
