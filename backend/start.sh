#!/bin/sh
set -e

echo "🔧 Gerando Prisma Client..."
bunx prisma generate

echo "📊 Aplicando migrações do banco de dados..."
bunx prisma db push --skip-generate || echo "⚠️  Aviso: Erro ao aplicar migrações (pode ser normal se já existirem)"

echo "🚀 Iniciando servidor..."
exec bun run src/index.ts
