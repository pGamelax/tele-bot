# Frontend - Tele Bot Dashboard

Dashboard completo para gerenciamento de bots do Telegram, construído com Next.js, Shadcn/ui e Better Auth.

## Características

- ✅ Dashboard completo com métricas de vendas
- ✅ Tracking de PIX gerados e pagos
- ✅ Visualização de usuários que interagiram
- ✅ Gráficos de receita
- ✅ Tema light com cor principal laranja
- ✅ Autenticação com Better Auth
- ✅ Interface moderna com Shadcn/ui

## Instalação

1. Instale as dependências:
```bash
bun install
```

2. Configure as variáveis de ambiente:
```bash
cp .env.example .env.local
```

Edite o arquivo `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000
```

3. Execute o servidor de desenvolvimento:
```bash
bun run dev
```

O dashboard estará disponível em `http://localhost:3001` (ou a porta configurada).

## Estrutura

- `app/` - Páginas e rotas do Next.js
- `components/` - Componentes React
- `lib/` - Utilitários e configurações
- `app/globals.css` - Estilos globais com tema laranja

## Tecnologias

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Shadcn/ui
- Better Auth
- Lucide React (ícones)
