#!/bin/bash

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

echo "Criando usuário via Better Auth..."
echo "Email: $EMAIL"
echo "Nome: ${NAME:-'(não informado)'}"
echo "API: ${API_URL}${BASE_PATH}/sign-up/email"

# Fazer requisição para Better Auth
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}${BASE_PATH}/sign-up/email" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${EMAIL}\",
    \"password\": \"${PASSWORD}\",
    \"name\": \"${NAME}\"
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ]; then
    echo "✅ Usuário criado com sucesso!"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
    echo "❌ Erro ao criar usuário (HTTP $HTTP_CODE)"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    exit 1
fi
