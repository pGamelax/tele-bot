import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { staticPlugin } from "@elysiajs/static";
import { PrismaClient } from "@prisma/client";
import { join } from "path";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { auth } from "./lib/auth";
import { botRoutes } from "./routes/bots";
import { paymentRoutes } from "./routes/payments";
import { uploadRoutes } from "./routes/upload";
import { leadRoutes } from "./routes/leads";
import { webhookRoutes } from "./routes/webhook";
import { trackingRoutes } from "./routes/tracking";
import { queueRoutes } from "./routes/queue";
import { BotManager } from "./services/bot-manager";
import { restoreResends } from "./services/resend-queue";

const prisma = new PrismaClient();
const botManager = BotManager.getInstance();

// Inicializar bots ativos ao iniciar o servidor
let botsInitialized = false;
async function initializeBots() {
  if (botsInitialized) {
    return;
  }
  botsInitialized = true;
  try {
    // Aguardar um pouco para garantir que o servidor está pronto
    await new Promise(resolve => setTimeout(resolve, 2000));
    await botManager.restartAllBots();
    // Restaurar reenvios do banco de dados
    await restoreResends();
  } catch (error) {
    console.error("❌ Erro ao inicializar bots:", error);
    botsInitialized = false; // Resetar em caso de erro para permitir nova tentativa
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

const app = new Elysia()
  // Handler manual para OPTIONS (preflight)
  .options("*", ({ set, request }) => {
    const origin = request.headers.get("origin")
    const allowedOrigins = [
      process.env.FRONTEND_URL || "http://localhost:3001",
      "http://localhost:3001",
      "http://127.0.0.1:3001",
    ]
    
    if (origin && allowedOrigins.includes(origin)) {
      set.headers["Access-Control-Allow-Origin"] = origin
      set.headers["Access-Control-Allow-Credentials"] = "true"
      set.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, PATCH, OPTIONS"
      set.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, Cookie, X-Requested-With"
      set.headers["Access-Control-Max-Age"] = "86400"
    }
    set.status = 204
    return ""
  })
  .use(cors({
    credentials: true,
    origin: (request: Request) => {
      // Permitir requisições do frontend Next.js
      const allowedOrigins = [
        process.env.FRONTEND_URL || "http://localhost:3001",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
      ]
      const origin = request.headers.get("origin")
      // Se não houver origin (requisições do mesmo domínio ou Postman), permitir
      if (!origin) return true
      // Verificar se o origin está na lista de permitidos
      const isAllowed = allowedOrigins.includes(origin)
      return isAllowed
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie", "X-Requested-With"],
    exposeHeaders: ["Content-Type", "Set-Cookie"],
  }))
  .use(swagger())
  // Servir arquivos estáticos de uploads
  .use(staticPlugin({ 
    assets: process.env.UPLOAD_DIR || join(process.cwd(), "uploads"), 
    prefix: "/uploads",
    alwaysStatic: true,
  }))
  // Rota adicional para garantir que os arquivos sejam servidos
  .get("/uploads/*", async ({ params, set }) => {
    try {
      const fileName = (params as any)["*"];
      const uploadDir = process.env.UPLOAD_DIR || join(process.cwd(), "uploads");
      const filePath = join(uploadDir, fileName);
      
      // Tentar múltiplos caminhos
      let finalPath = filePath;
      if (!existsSync(filePath)) {
        // Tentar caminho relativo
        const relativePath = join(process.cwd(), "uploads", fileName);
        if (existsSync(relativePath)) {
          finalPath = relativePath;
        } else {
          // Tentar caminho Docker
          const dockerPath = join("/app/backend/uploads", fileName);
          if (existsSync(dockerPath)) {
            finalPath = dockerPath;
          }
        }
      }
      
      if (existsSync(finalPath)) {
        const file = await readFile(finalPath);
        const ext = fileName.split(".").pop()?.toLowerCase();
        const contentType = ext === "mp4" || ext === "webm" || ext === "ogg" || ext === "mov" 
          ? "video/mp4" 
          : ext === "jpg" || ext === "jpeg" 
          ? "image/jpeg" 
          : ext === "png" 
          ? "image/png" 
          : "application/octet-stream";
        set.headers["Content-Type"] = contentType;
        set.headers["Cache-Control"] = "public, max-age=31536000";
        return file;
      } else {
        console.error(`[Static] Arquivo não encontrado em nenhum caminho: ${fileName}`);
        set.status = 404;
        return { error: "Arquivo não encontrado" };
      }
    } catch (error: any) {
      console.error("[Static] Erro ao servir arquivo:", error);
      set.status = 500;
      return { error: "Erro ao servir arquivo" };
    }
  })
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
  .use(trackingRoutes)
  .use(queueRoutes)
  .get("/", () => ({ message: "Tele Bot API" }));

const port = parseInt(process.env.PORT || "3000");
app.listen(port, () => {
  console.log(`🦊 Elysia is running at http://0.0.0.0:${port}`);
  // Inicializar bots após o servidor iniciar completamente
  initializeBots();
});

export type App = typeof app;
