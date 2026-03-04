#!/bin/sh
set -e

echo "🔧 Verificando Prisma Client..."
# Verificar se o Prisma Client já foi gerado (no Dockerfile)
if [ ! -f "./node_modules/.prisma/client/index.js" ]; then
  echo "⚠️  Prisma Client não encontrado, gerando..."
  bunx prisma generate
fi

echo "📊 Aplicando migrações do banco de dados..."
# Usar migrate deploy para produção (aplica apenas migrações pendentes)
if bunx prisma migrate deploy; then
  echo "✅ Migrações aplicadas com sucesso usando migrate deploy!"
else
  echo "⚠️  Erro ao aplicar migrações com migrate deploy, tentando db push como fallback..."
  if bunx prisma db push --skip-generate; then
    echo "✅ Migrações aplicadas com sucesso usando db push!"
  else
    echo "❌ Erro ao aplicar migrações do banco de dados"
    exit 1
  fi
fi

echo "✅ Migrações aplicadas com sucesso!"
echo "🚀 Iniciando servidor..."
# Bun pode executar TypeScript diretamente, não precisa de build
exec bun run src/index.ts
