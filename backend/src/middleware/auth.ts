import { Elysia } from "elysia";
import { auth } from "../lib/auth";

// Middleware que deriva o user do contexto e protege rotas
export const requireAuth = new Elysia({ name: "requireAuth" })
  .derive(async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    
    if (!session) {
      return {
        user: null,
        session: null,
      };
    }

    return {
      user: session.user,
      session: session.session,
    };
  })
  .onBeforeHandle(({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Não autorizado" };
    }
  });
