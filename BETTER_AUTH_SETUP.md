# Configuração do Better Auth

## Instalação

### Backend
```bash
cd backend
bun install better-auth
```

### Frontend
```bash
cd frontend
bun install better-auth
```

## Migração do Banco de Dados

O schema do Prisma foi atualizado para incluir as tabelas necessárias do Better Auth:
- `Account` - Contas de autenticação
- `Session` - Sessões de usuário
- `VerificationToken` - Tokens de verificação

Execute a migração:
```bash
cd backend
bun run db:migrate:generate
```

## Configuração

### Backend (.env)
```env
BETTER_AUTH_SECRET="seu-secret-key-aqui"
BETTER_AUTH_URL="http://localhost:3000"
FRONTEND_URL="http://localhost:5173"
```

### Frontend
O Better Auth está configurado para usar `http://localhost:3000` como baseURL.
Para produção, defina `VITE_API_URL` no `.env` do frontend.

## Estrutura do Frontend

### Organização
- `src/lib/auth.ts` - Cliente do Better Auth
- `src/contexts/auth-context.tsx` - Contexto de autenticação
- `src/components/auth/protected-route.tsx` - Componente para rotas protegidas
- `src/components/layouts/dashboard-layout.tsx` - Layout do dashboard
- `src/hooks/use-api.ts` - Hook para requisições autenticadas

### Rotas Protegidas
Todas as rotas que precisam de autenticação estão envolvidas com `<ProtectedRoute>`:
- `/dashboard`
- `/bots/new`
- `/bots/$id`

### Uso
```tsx
import { useAuth } from "@/contexts/auth-context";
import { useApi } from "@/hooks/use-api";

function MyComponent() {
  const { user, isLoading } = useAuth();
  const { fetchWithAuth } = useApi();

  // Fazer requisição autenticada
  const response = await fetchWithAuth("/api/bots");
}
```

## Autenticação

### Login/Registro
A página inicial (`/`) permite fazer login ou criar conta usando Better Auth.

### Sessão
A sessão é gerenciada automaticamente pelo Better Auth usando cookies HTTP-only.

## Middleware de Autenticação

O backend usa `requireAuth` middleware para proteger rotas:
```typescript
import { requireAuth } from "../middleware/auth";

export const botRoutes = new Elysia({ prefix: "/api/bots" })
  .use(requireAuth)
  .get("/", async ({ user }) => {
    // user está disponível aqui
  });
```

## Próximos Passos

1. Execute a migração do banco de dados
2. Configure as variáveis de ambiente
3. Teste o login/registro
4. Verifique se as rotas protegidas funcionam corretamente
