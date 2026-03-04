#!/bin/sh

# Script para corrigir um usuário que foi criado sem Account
# Uso: ./fix-user.sh <email> <senha>

if [ $# -lt 2 ]; then
    echo "Uso: $0 <email> <senha>"
    echo "Exemplo: $0 admin@example.com senha123"
    exit 1
fi

EMAIL=$1
PASSWORD=$2

# Carregar variáveis de ambiente do arquivo .env se existir
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

echo "Verificando e corrigindo usuário..."
echo "Email: $EMAIL"

bun -e "
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function fixUser() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: '$EMAIL' },
      include: {
        accounts: true,
      },
    });

    if (!user) {
      console.log('❌ Usuário não encontrado no banco de dados');
      console.log('Use o script create-user.sh para criar o usuário primeiro');
      await prisma.\$disconnect();
      process.exit(1);
    }

    console.log('✅ Usuário encontrado:');
    console.log('ID:', user.id);
    console.log('Email:', user.email);
    console.log('Nome:', user.name);
    console.log('Accounts:', user.accounts.length);

    if (user.accounts.length === 0) {
      console.log('⚠️  Usuário não tem Account. Criando Account...');
      
      const hashedPassword = await hash('$PASSWORD', 10);
      
      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          accounts: {
            create: {
              accountId: user.id,
              providerId: 'credential',
              provider: 'credential',
              providerAccountId: user.email,
              type: 'credential',
              password: hashedPassword,
            },
          },
        },
      });

      console.log('✅ Account criada com sucesso!');
    } else {
      console.log('✅ Usuário já tem Account associada');
      
      if (!user.password) {
        console.log('⚠️  Usuário não tem senha. Atualizando senha...');
        const hashedPassword = await hash('$PASSWORD', 10);
        
        await prisma.user.update({
          where: { id: user.id },
          data: {
            password: hashedPassword,
          },
        });
        
        await prisma.account.updateMany({
          where: { userId: user.id, provider: 'credential' },
          data: {
            password: hashedPassword,
          },
        });
        
        console.log('✅ Senha atualizada com sucesso!');
      }
    }

    await prisma.\$disconnect();
    console.log('✅ Usuário corrigido! Tente fazer login novamente.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao corrigir usuário:', error.message);
    console.error(error.stack);
    await prisma.\$disconnect();
    process.exit(1);
  }
}

fixUser();
"
