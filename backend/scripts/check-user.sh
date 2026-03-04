#!/bin/sh

# Script para verificar se um usuário existe no banco de dados
# Uso: ./check-user.sh <email>

if [ $# -lt 1 ]; then
    echo "Uso: $0 <email>"
    echo "Exemplo: $0 admin@example.com"
    exit 1
fi

EMAIL=$1

# Carregar variáveis de ambiente do arquivo .env se existir
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

echo "Verificando usuário no banco de dados..."
echo "Email: $EMAIL"

bun -e "
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUser() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: '$EMAIL' },
      include: {
        accounts: true,
        sessions: true,
      },
    });

    if (!user) {
      console.log('❌ Usuário não encontrado no banco de dados');
      process.exit(1);
    }

    console.log('✅ Usuário encontrado:');
    console.log(JSON.stringify({
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      hasPassword: !!user.password,
      accountsCount: user.accounts.length,
      sessionsCount: user.sessions.length,
      accounts: user.accounts,
    }, null, 2));

    if (user.accounts.length === 0) {
      console.log('⚠️  AVISO: Usuário não tem Account associada! Isso pode causar problemas no login.');
    }

    await prisma.\$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao verificar usuário:', error.message);
    await prisma.\$disconnect();
    process.exit(1);
  }
}

checkUser();
"
