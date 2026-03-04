#!/bin/sh

# Script para criar usuário usando Better Auth API
# Uso: ./create-user.sh <email> <senha> [nome]

if [ $# -lt 2 ]; then
    echo "Uso: $0 <email> <senha> [nome]"
    echo "Exemplo: $0 admin@example.com senha123 'Admin User'"
    exit 1
fi

EMAIL=$1
PASSWORD=$2
NAME=${3:-""}

# Carregar variáveis de ambiente do arquivo .env se existir
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Configurar URL da API
API_URL=${BETTER_AUTH_URL:-"http://localhost:3000"}
BASE_PATH="/api/auth"
ENDPOINT="${API_URL}${BASE_PATH}/sign-up/email"

echo "Criando usuário via Better Auth..."
echo "Email: $EMAIL"
echo "Nome: ${NAME:-'(não informado)'}"
echo "API: $ENDPOINT"

# Usar Bun para fazer requisição HTTP (Bun tem fetch nativo)
bun -e "
const email = '$EMAIL';
const password = '$PASSWORD';
const name = '$NAME';
const endpoint = '$ENDPOINT';

try {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: email,
      password: password,
      name: name || undefined,
    }),
  });

  let data;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    const text = await response.text();
    data = { message: text || 'Resposta não é JSON' };
  }
  
  const status = response.status;

  if (status === 200 || status === 201) {
    console.log('✅ Usuário criado com sucesso!');
    console.log(JSON.stringify(data, null, 2));
    process.exit(0);
  } else {
    console.error('❌ Erro ao criar usuário (HTTP ' + status + ')');
    console.error('Resposta completa:');
    console.error(JSON.stringify(data, null, 2));
    
    if (status === 500) {
      console.log('');
      console.log('⚠️  Erro 500 detectado. Verificando se o usuário foi criado mesmo assim...');
      
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      
      try {
        const user = await prisma.user.findUnique({
          where: { email: email },
          include: { accounts: true },
        });
        
        if (user) {
          console.log('✅ Usuário encontrado no banco de dados!');
          console.log('ID:', user.id);
          console.log('Email:', user.email);
          console.log('Accounts:', user.accounts.length);
          
          if (user.accounts.length === 0) {
            console.log('');
            console.log('⚠️  AVISO: Usuário criado mas sem Account associada!');
            console.log('Execute o script fix-user.sh para corrigir:');
            console.log(\`  ./scripts/fix-user.sh \${email} \${password}\`);
          } else {
            console.log('✅ Usuário parece estar completo. Tente fazer login.');
          }
        } else {
          console.log('❌ Usuário não foi criado no banco de dados.');
        }
        
        await prisma.\$disconnect();
      } catch (dbError) {
        console.error('Erro ao verificar banco:', dbError.message);
      }
    }
    
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Erro ao fazer requisição:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}
"
