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

  const data = await response.json();
  const status = response.status;

  if (status === 200 || status === 201) {
    console.log('✅ Usuário criado com sucesso!');
    console.log(JSON.stringify(data, null, 2));
    process.exit(0);
  } else {
    console.error('❌ Erro ao criar usuário (HTTP ' + status + ')');
    console.error(JSON.stringify(data, null, 2));
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Erro ao fazer requisição:', error.message);
  process.exit(1);
}
"
