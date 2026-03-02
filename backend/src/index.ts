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
      const allowedOrigins = [
        process.env.FRONTEND_URL || "http://localhost:3001",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
      ]
      const origin = request.headers.get("origin")
      if (!origin) return true
      const isAllowed = allowedOrigins.includes(origin)
      return isAllowed
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie", "X-Requested-With"],
    exposeHeaders: ["Content-Type", "Set-Cookie"],
  }))
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
  .get("/", () => ({ message: "Tele Bot API" }));

const port = parseInt(process.env.PORT || "3000");
app.listen(port, () => {
  console.log(`Elysia is running at http://0.0.0.0:${port}`);
  initializeBots();
});

export type App = typeof app;
