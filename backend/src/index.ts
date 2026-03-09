import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { PrismaClient } from "@prisma/client";
import { auth } from "./lib/auth";
import { botRoutes } from "./routes/bots";
import { paymentRoutes } from "./routes/payments";
import { leadRoutes } from "./routes/leads";
import { webhookRoutes } from "./routes/webhook";
import { trackingRoutes } from "./routes/tracking";
import { queueRoutes } from "./routes/queue";
import { manualBotRoutes } from "./routes/manual-bot";
import { BotManager } from "./services/bot-manager";
import { restoreResends, resendWorker } from "./services/resend-queue";

const prisma = new PrismaClient();
const botManager = BotManager.getInstance();

let botsInitialized = false;
async function initializeBots() {
  if (botsInitialized) {
    return;
  }
  botsInitialized = true;
  try {
    await new Promise(resolve => setTimeout(resolve, 2000));
    await botManager.restartAllBots();
    await restoreResends();
  } catch (error) {
    console.error("Erro ao inicializar bots:", error);
    botsInitialized = false;
  }
}

function getAllowedOrigins(): string[] {
  const origins = new Set<string>([
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "https://bot-frontend.clashdata.pro",
  ]);
  if (process.env.FRONTEND_URL) {
    origins.add(process.env.FRONTEND_URL);
  }
  if (process.env.ALLOWED_ORIGINS) {
    process.env.ALLOWED_ORIGINS.split(",").forEach((o) => origins.add(o.trim()));
  }
  return Array.from(origins);
}

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
  .options("*", ({ set, request }) => {
      const origin = request.headers.get("origin")
      const allowedOrigins = getAllowedOrigins()
      
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
      const allowedOrigins = getAllowedOrigins()
      const origin = request.headers.get("origin")
      if (!origin) return true
      const isAllowed = allowedOrigins.includes(origin)
      return isAllowed
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie", "X-Requested-With"],
    exposeHeaders: ["Content-Type", "Set-Cookie"],
  }))
  .onError(({ code, error, set }) => {
    console.error(`[Elysia Error] ${code}:`, error);
    if (code === "NOT_FOUND") {
      set.status = 404;
      return { error: "Not found" };
    }
    if (code === "VALIDATION") {
      set.status = 400;
      return { error: "Validation error", details: error.message };
    }
    set.status = 500;
    return { 
      error: "Internal server error", 
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined
    };
  })
  .use(swagger())
  .decorate("db", prisma)
  .mount(auth.handler)
  .derive(async ({ request }) => {
    return await userMiddleware(request);
  })
  .use(botRoutes)
  .use(paymentRoutes)
  .use(leadRoutes)
  .use(webhookRoutes)
  .use(trackingRoutes)
  .use(queueRoutes)
  .use(manualBotRoutes)
  .get("/", () => ({ message: "Tele Bot API" }));

const port = parseInt(process.env.PORT || "3000");
app.listen(port, () => {
  console.log(`Elysia is running at http://0.0.0.0:${port}`);
  initializeBots();
});

export type App = typeof app;
