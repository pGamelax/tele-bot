import { Elysia } from "elysia";
import { PrismaClient } from "@prisma/client";
import { auth } from "../lib/auth";
import { BotManager } from "../services/bot-manager";
import { scheduleResends, removeResendJobs } from "../services/resend-queue";

const prisma = new PrismaClient();
const botManager = BotManager.getInstance();

export const leadRoutes = new Elysia({ prefix: "/api/leads" })
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
      const isNew = query.isNew === "true" ? true : query.isNew === "false" ? false : undefined;

      // Buscar bots do usuário
      const userBots = await prisma.bot.findMany({
        where: { userId: user.id },
        select: { id: true },
      });

      const botIds = userBots.map((bot) => bot.id);

      if (botIds.length === 0) {
        return { leads: [] };
      }

      const where: any = {
        botId: { in: botIds },
      };

      if (botId) {
        where.botId = botId;
      }

      if (isNew !== undefined) {
        where.isNew = isNew;
      }

      const leads = await prisma.lead.findMany({
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
      });

      return { leads };
    } catch (error: any) {
      set.status = 500;
      return { error: error.message || "Erro ao buscar leads" };
    }
  })
  .post("/", async ({ user, body, set }) => {
    try {
      if (!user) {
        set.status = 401;
        return { error: "Não autorizado" };
      }

      const {
        botId,
        telegramChatId,
        telegramUsername,
        firstName,
        lastName,
        notes,
      } = body as {
        botId: string;
        telegramChatId: string;
        telegramUsername?: string;
        firstName?: string;
        lastName?: string;
        notes?: string;
      };

      // Verificar se o bot pertence ao usuário
      const bot = await prisma.bot.findFirst({
        where: {
          id: botId,
          userId: user.id,
        },
      });

      if (!bot) {
        set.status = 404;
        return { error: "Bot não encontrado" };
      }

      // Verificar se já existe um lead para este chat
      const existingLead = await prisma.lead.findFirst({
        where: {
          botId,
          telegramChatId,
        },
      });

      if (existingLead) {
        // Atualizar lead existente
        const lead = await prisma.lead.update({
          where: { id: existingLead.id },
          data: {
            telegramUsername,
            firstName,
            lastName,
            notes,
            isNew: true, // Marcar como novo novamente
          },
          include: {
            bot: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        return { lead };
      }

      // Criar novo lead
      const lead = await prisma.lead.create({
        data: {
          botId,
          telegramChatId,
          telegramUsername,
          firstName,
          lastName,
          notes,
          isNew: true,
        },
        include: {
          bot: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return { lead };
    } catch (error: any) {
      set.status = 500;
      return { error: error.message || "Erro ao criar lead" };
    }
  })
  .put("/:id", async ({ user, params, body, set }) => {
    try {
      if (!user) {
        set.status = 401;
        return { error: "Não autorizado" };
      }

      const {
        isNew,
        notes,
        contactedAt,
        convertedAt,
      } = body as {
        isNew?: boolean;
        notes?: string;
        contactedAt?: string;
        convertedAt?: string;
      };

      // Verificar se o lead pertence a um bot do usuário
      const lead = await prisma.lead.findUnique({
        where: { id: params.id },
        include: {
          bot: {
            select: {
              userId: true,
            },
          },
        },
      });

      if (!lead) {
        set.status = 404;
        return { error: "Lead não encontrado" };
      }

      if (lead.bot.userId !== user.id) {
        set.status = 403;
        return { error: "Acesso negado" };
      }

      const updateData: any = {};
      if (isNew !== undefined) updateData.isNew = isNew;
      if (notes !== undefined) updateData.notes = notes;
      if (contactedAt !== undefined) updateData.contactedAt = contactedAt ? new Date(contactedAt) : null;
      if (convertedAt !== undefined) updateData.convertedAt = convertedAt ? new Date(convertedAt) : null;

      const updatedLead = await prisma.lead.update({
        where: { id: params.id },
        data: updateData,
        include: {
          bot: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return { lead: updatedLead };
    } catch (error: any) {
      set.status = 500;
      return { error: error.message || "Erro ao atualizar lead" };
    }
  })
  .delete("/:id", async ({ user, params, set }) => {
    try {
      if (!user) {
        set.status = 401;
        return { error: "Não autorizado" };
      }

      // Verificar se o lead pertence a um bot do usuário
      const lead = await prisma.lead.findUnique({
        where: { id: params.id },
        include: {
          bot: {
            select: {
              userId: true,
            },
          },
        },
      });

      if (!lead) {
        set.status = 404;
        return { error: "Lead não encontrado" };
      }

      if (lead.bot.userId !== user.id) {
        set.status = 403;
        return { error: "Acesso negado" };
      }

      await prisma.lead.delete({
        where: { id: params.id },
      });

      return { success: true };
    } catch (error: any) {
      set.status = 500;
      return { error: error.message || "Erro ao deletar lead" };
    }
  })
  .patch("/:id/resend", async ({ user, params, body, set }) => {
    try {
      if (!user) {
        set.status = 401;
        return { error: "Não autorizado" };
      }

      const { paused } = body as { paused: boolean };

      // Verificar se o lead pertence a um bot do usuário
      const lead = await prisma.lead.findUnique({
        where: { id: params.id },
        include: {
          bot: {
            select: {
              userId: true,
              id: true,
              isActive: true,
              resendFirstDelay: true,
              resendInterval: true,
            },
          },
        },
      });

      if (!lead) {
        set.status = 404;
        return { error: "Lead não encontrado" };
      }

      if (lead.bot.userId !== user.id) {
        set.status = 403;
        return { error: "Acesso negado" };
      }

      // Verificar se o usuário já comprou neste bot
      const paidPayment = await prisma.payment.findFirst({
        where: {
          botId: lead.botId,
          telegramChatId: lead.telegramChatId,
          status: "paid",
        },
      });

      if (paidPayment) {
        set.status = 400;
        return { error: "Não é possível pausar/retomar reenvios para um lead que já comprou" };
      }

      // Atualizar status de pausa
      const updatedLead = await prisma.lead.update({
        where: { id: params.id },
        data: { resendPaused: paused },
        include: {
          bot: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Se retomando e o bot está ativo, agendar reenvios
      if (!paused && lead.bot.isActive && !paidPayment) {
        await scheduleResends(
          lead.botId,
          lead.telegramChatId,
          lead.bot.resendFirstDelay || 20,
          lead.bot.resendInterval || 10
        );
      } else if (paused) {
        // Se pausando, remover jobs
        await removeResendJobs(lead.botId, lead.telegramChatId);
      }

      return { lead: updatedLead };
    } catch (error: any) {
      set.status = 500;
      return { error: error.message || "Erro ao atualizar status de reenvio" };
    }
  });
