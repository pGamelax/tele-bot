# Solução para Problema do Prisma com Bun

## Problema

Ao executar `bunx prisma migrate dev`, o Prisma tenta gerar o client automaticamente e pode falhar com erro de "git clone" no Windows com Bun.

## Solução

Sempre gere o Prisma Client **antes** de executar migrações:

```bash
# 1. Gerar Prisma Client
bun run db:generate

# 2. Executar migrações (com --skip-generate)
bun run db:migrate
```

Ou use o script combinado:

```bash
bun run db:migrate:generate
```

## Por quê?

O Bun às vezes tem problemas ao resolver dependências do Prisma durante a geração automática. Gerar o client separadamente resolve esse problema.

## Scripts Disponíveis

- `bun run db:generate` - Gera apenas o Prisma Client
- `bun run db:migrate` - Executa migrações (pula geração)
- `bun run db:migrate:generate` - Gera client e executa migrações
- `bun run db:studio` - Abre Prisma Studio
- `bun run db:push` - Faz push do schema (pula geração)
