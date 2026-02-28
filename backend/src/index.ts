import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { staticPlugin } from "@elysiajs/static";
import { PrismaClient } from "@prisma/client";
import { join } from "path";
import { auth } from "./lib/auth";
import { botRoutes } from "./routes/bots";
import { paymentRoutes } from "./routes/payments";
import { uploadRoutes } from "./routes/upload";
import { leadRoutes } from "./routes/leads";
import { webhookRoutes } from "./routes/webhook";
import { BotManager } from "./services/bot-manager";

const prisma = new PrismaClient();
const botManager = BotManager.getInstance();

// Inicializar bots ativos ao iniciar o servidor
async function initializeBots() {
  try {
    await botManager.restartAllBots();
    console.log("✅ Todos os bots ativos foram inicializados");
  } catch (error) {
    console.error("❌ Erro ao inicializar bots:", error);
  }
}

// User middleware (computa user e session e passa para as rotas)
const userMiddleware = async (request: Request) => {
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
};

const app = new Elysia({
  bodyLimit: 60 * 1024 * 1024, // 60MB para permitir uploads de vídeos grandes
})
  .use(cors({
    credentials: true,
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
  }))
  .use(swagger())
  .use(staticPlugin({ 
    assets: process.env.UPLOAD_DIR || join(process.cwd(), "uploads"), 
    prefix: "/uploads" 
  }))
  .decorate("db", prisma)
  .mount(auth.handler)
  .derive(async ({ request }) => {
    return await userMiddleware(request);
  })
  .use(botRoutes)
  .use(paymentRoutes)
  .use(uploadRoutes)
  .use(leadRoutes)
  .use(webhookRoutes)
  .get("/", () => ({ message: "Tele Bot API" }))
  .listen(process.env.PORT || 3000);

// Inicializar bots após o servidor iniciar
initializeBots();

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`
);

export type App = typeof app;
