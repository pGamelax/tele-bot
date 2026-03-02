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
  .onBeforeHandle(({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Não autorizado" };
    }
  })
  .get("/", async ({ user, query, set }) => {
    try {

      const botId = query.botId as string | undefined;
      const status = query.status as string | undefined;
      const startDate = query.startDate as string | undefined;
      const endDate = query.endDate as string | undefined;
      const limit = query.limit ? parseInt(query.limit as string) : 100;

      const userBots = await prisma.bot.findMany({
        where: { userId: user.id },
        select: { id: true },
      });

      const botIds = userBots.map((bot) => bot.id);

      if (botIds.length === 0) {
        return { payments: [] };
      }

      const where: any = {
        botId: botId ? botId : { in: botIds },
      };

      if (botId) {
        if (!botIds.includes(botId)) {
          set.status = 403;
          return { error: "Acesso negado" };
        }
      }

      if (status && (status === "paid" || status === "pending" || status === "expired")) {
        where.status = status;
      }

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = new Date(startDate);
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          where.createdAt.lte = end;
        }
        
        if (Object.keys(where.createdAt).length === 0) {
          delete where.createdAt;
        }
      }

      const payments = await prisma.payment.findMany({
        where,
        include: {
          bot: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      return { payments };
    } catch (error) {
      console.error("Erro ao buscar pagamentos:", error);
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
