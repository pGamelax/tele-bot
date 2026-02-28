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

# Produção com Nginx
FROM nginx:alpine AS production
WORKDIR /usr/share/nginx/html

# Copiar arquivos buildados
COPY --from=build /app/dist ./

# Expor porta
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
