#!/bin/sh
set -e

echo "🔧 Verificando Prisma Client..."
# Verificar se o Prisma Client já foi gerado (no Dockerfile)
if [ ! -f "./node_modules/.prisma/client/index.js" ]; then
  echo "⚠️  Prisma Client não encontrado, gerando..."
  bunx prisma generate
fi

echo "📊 Aplicando migrações do banco de dados..."
bunx prisma db push --skip-generate || echo "⚠️  Aviso: Erro ao aplicar migrações (pode ser normal se já existirem)"

echo "🚀 Iniciando servidor..."
# Se o build existir, usar o build, senão usar src/index.ts (desenvolvimento)
if [ -f "./build/index.js" ]; then
  exec bun run build/index.js
else
  exec bun run src/index.ts
fi
