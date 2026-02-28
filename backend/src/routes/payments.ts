import { Elysia } from "elysia";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const paymentRoutes = new Elysia({ prefix: "/api/payments" })
  .get("/", async ({ query, set }) => {
    try {
      const botId = query.botId as string;
      if (!botId) {
        set.status = 400;
        return { error: "botId é obrigatório" };
      }

      const payments = await prisma.payment.findMany({
        where: { botId },
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
