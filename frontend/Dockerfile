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

# Expor porta (usar variável de ambiente PORT ou padrão 3000)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "const port = process.env.PORT || 3000; require('http').get(`http://localhost:${port}`, (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => process.exit(1))"

# Servir arquivos estáticos
# -s: modo single-page application (fallback para index.html)
# -l: porta para escutar (usa PORT do ambiente ou 3000)
# --no-clipboard: não tentar copiar URL
# --no-open: não tentar abrir no navegador
CMD sh -c "serve -s dist -l ${PORT:-3000} --no-clipboard --no-open"
