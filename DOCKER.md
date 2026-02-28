# Deploy em Produção com Docker

## Arquitetura Recomendada

Para produção com múltiplos bots, recomenda-se usar **Docker containers separados** para cada bot. Isso garante:

- ✅ **Isolamento**: Se um bot cair, os outros continuam funcionando
- ✅ **Escalabilidade**: Fácil adicionar/remover bots
- ✅ **Manutenção**: Atualizações independentes
- ✅ **Recursos**: Controle de recursos por bot

## Estrutura de Deploy

```
tele-bot/
├── docker-compose.yml          # PostgreSQL + Backend API
├── docker-compose.bots.yml     # Containers individuais para cada bot
└── bots/
    ├── bot-1/
    │   └── Dockerfile
    └── bot-2/
        └── Dockerfile
```

## Opção 1: Container por Bot (Recomendado)

Cada bot roda em um container Docker separado, conectando-se ao mesmo banco de dados.

### Vantagens:
- Isolamento total entre bots
- Fácil escalar horizontalmente
- Um bot não afeta os outros
- Pode usar diferentes versões/configurações

### Desvantagens:
- Mais recursos (cada container consome memória)
- Mais complexidade de gerenciamento

## Opção 2: Process Manager (Alternativa)

Usar PM2 ou similar para gerenciar processos de bot dentro de um único container.

### Vantagens:
- Menor uso de recursos
- Mais simples de gerenciar

### Desvantagens:
- Se um processo travar, pode afetar outros
- Menos isolamento

## Exemplo: Docker Compose para Bots

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  api:
    build: ./backend
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
    depends_on:
      - postgres

  bot-1:
    build: ./bots/bot-1
    environment:
      BOT_ID: bot-1-id
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
    restart: unless-stopped
    depends_on:
      - postgres
      - api

  bot-2:
    build: ./bots/bot-2
    environment:
      BOT_ID: bot-2-id
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
    restart: unless-stopped
    depends_on:
      - postgres
      - api
```

## Recomendação Final

**Use containers separados para produção** se:
- Você tem múltiplos bots
- Precisa de alta disponibilidade
- Quer isolamento entre bots
- Tem recursos suficientes na VPS

**Use process manager** se:
- Tem poucos bots
- Recursos limitados
- Simplicidade é prioridade
