import { Elysia } from "elysia";
import { PrismaClient } from "@prisma/client";
import { auth } from "../lib/auth";

const prisma = new PrismaClient();

export const paymentRoutes = new Elysia({ prefix: "/api/payments" })
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
  .get("/", async ({ user, query, set }) => {
    try {
      if (!user) {
        set.status = 401;
        return { error: "Não autorizado" };
      }

      const botId = query.botId as string | undefined;

      // Se botId for fornecido, buscar apenas desse bot
      if (botId) {
        // Verificar se o bot pertence ao usuário
        const bot = await prisma.bot.findFirst({
          where: { id: botId, userId: user.id },
        });

        if (!bot) {
          set.status = 403;
          return { error: "Acesso negado" };
        }

        const payments = await prisma.payment.findMany({
          where: { botId },
          orderBy: { createdAt: "desc" },
          take: 100,
        });

        return { payments };
      }

      // Se não houver botId, buscar todos os pagamentos dos bots do usuário
      const userBots = await prisma.bot.findMany({
        where: { userId: user.id },
        select: { id: true },
      });

      const botIds = userBots.map((bot) => bot.id);

      if (botIds.length === 0) {
        return { payments: [] };
      }

      const payments = await prisma.payment.findMany({
        where: { botId: { in: botIds } },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      return { payments };
    } catch (error) {
      set.status = 500;
      return { error: "Erro ao buscar pagamentos" };
    }
  })
  .get("/:id", async ({ params, set }) => {
    try {
      const payment = await prisma.payment.findUnique({
        where: { id: params.id },
      });

      if (!payment) {
        set.status = 404;
        return { error: "Pagamento não encontrado" };
      }

      return { payment };
    } catch (error) {
      set.status = 500;
      return { error: "Erro ao buscar pagamento" };
    }
  });
