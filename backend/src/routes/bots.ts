import { Elysia } from "elysia";
import { PrismaClient } from "@prisma/client";
import { BotManager } from "../services/bot-manager";
import { auth } from "../lib/auth";

const prisma = new PrismaClient();
const botManager = BotManager.getInstance();

export const botRoutes = new Elysia({ prefix: "/api/bots" })
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
  .get("/stats", async ({ user, set }) => {
    try {
      if (!user) {
        set.status = 401;
        return { error: "Não autorizado" };
      }

      // Buscar todos os bots do usuário
      const userBots = await prisma.bot.findMany({
        where: { userId: user.id },
        select: { id: true },
      });

      const botIds = userBots.map((bot) => bot.id);

      if (botIds.length === 0) {
        // Retornar array vazio para revenueByDay (últimos 7 dias)
        const revenueByDay: { date: string; revenue: number }[] = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          date.setHours(0, 0, 0, 0);
          revenueByDay.push({
            date: date.toISOString().split('T')[0],
            revenue: 0,
          });
        }

        return {
          stats: {
            totalBots: 0,
            activeBots: 0,
            totalUsers: 0,
            usersWhoPurchased: 0,
            totalPixGenerated: 0,
            totalRevenue: 0,
            totalRevenueCents: 0,
            todayRevenue: 0,
            conversionRate: 0,
            revenueGrowth: 0,
            revenueByDay,
            accountHealth: "Baixo",
            accountHealthPercentage: 0,
          },
        };
      }

      // Estatísticas gerais de todos os bots
      const totalUsers = await prisma.payment.groupBy({
        by: ["telegramChatId"],
        where: { botId: { in: botIds } },
        _count: true,
      });

      const totalPixGenerated = await prisma.payment.count({
        where: { 
          botId: { in: botIds },
          status: "paid",
        },
      });

      const paidPayments = await prisma.payment.findMany({
        where: {
          botId: { in: botIds },
          status: "paid",
        },
        select: {
          amount: true,
        },
      });

      const totalRevenue = paidPayments.reduce((sum, payment) => sum + payment.amount, 0);

      const usersWhoPurchased = await prisma.payment.groupBy({
        by: ["telegramChatId"],
        where: {
          botId: { in: botIds },
          status: "paid",
        },
        _count: true,
      });

      const activeBots = await prisma.bot.count({
        where: {
          userId: user.id,
          isActive: true,
        },
      });

      // Vendas de hoje
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);

      const todayPayments = await prisma.payment.findMany({
        where: {
          botId: { in: botIds },
          status: "paid",
          paidAt: {
            gte: today,
            lte: todayEnd,
          },
        },
        select: {
          amount: true,
        },
      });

      const todayRevenue = todayPayments.reduce((sum, payment) => sum + payment.amount, 0);

      // Vendas do mês anterior para comparação
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      lastMonth.setDate(1);
      lastMonth.setHours(0, 0, 0, 0);
      const lastMonthEnd = new Date(lastMonth);
      lastMonthEnd.setMonth(lastMonthEnd.getMonth() + 1);
      lastMonthEnd.setDate(0);
      lastMonthEnd.setHours(23, 59, 59, 999);

      const lastMonthPayments = await prisma.payment.findMany({
        where: {
          botId: { in: botIds },
          status: "paid",
          paidAt: {
            gte: lastMonth,
            lte: lastMonthEnd,
          },
        },
        select: {
          amount: true,
        },
      });

      const lastMonthRevenue = lastMonthPayments.reduce((sum, payment) => sum + payment.amount, 0);

      // Taxa de conversão (usuários que compraram / total de usuários)
      const conversionRate = totalUsers.length > 0 
        ? (usersWhoPurchased.length / totalUsers.length) * 100 
        : 0;

      // Receita dos últimos 7 dias para gráfico
      const revenueByDay: { date: string; revenue: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const dateEnd = new Date(date);
        dateEnd.setHours(23, 59, 59, 999);

        const dayPayments = await prisma.payment.findMany({
          where: {
            botId: { in: botIds },
            status: "paid",
            paidAt: {
              gte: date,
              lte: dateEnd,
            },
          },
          select: {
            amount: true,
          },
        });

        const dayRevenue = dayPayments.reduce((sum, payment) => sum + payment.amount, 0) / 100;
        revenueByDay.push({
          date: date.toISOString().split('T')[0],
          revenue: dayRevenue,
        });
      }

      // Calcular porcentagem de crescimento
      const revenueGrowth = lastMonthRevenue > 0 
        ? ((totalRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
        : 0;

      return {
        stats: {
          totalBots: userBots.length,
          activeBots,
          totalUsers: totalUsers.length,
          usersWhoPurchased: usersWhoPurchased.length,
          totalPixGenerated,
          totalRevenue: totalRevenue / 100, // Converter centavos para reais
          totalRevenueCents: totalRevenue,
          todayRevenue: todayRevenue / 100,
          conversionRate: Math.round(conversionRate * 100) / 100,
          revenueGrowth: Math.round(revenueGrowth * 100) / 100,
          revenueByDay,
          // Saúde da conta baseada em conversão e atividade
          accountHealth: conversionRate > 20 ? "Excelente" : conversionRate > 10 ? "Bom" : conversionRate > 5 ? "Regular" : "Baixo",
          accountHealthPercentage: Math.min(conversionRate * 5, 100), // Máximo 100%
        },
      };
    } catch (error: any) {
      set.status = 500;
      return { error: error.message || "Erro ao buscar estatísticas" };
    }
  })
  .get("/:id/stats", async ({ user, params, set }) => {
    try {
      if (!user) {
        set.status = 401;
        return { error: "Não autorizado" };
      }

      const bot = await prisma.bot.findUnique({
        where: { id: params.id, userId: user.id },
      });

      if (!bot) {
        set.status = 404;
        return { error: "Bot não encontrado" };
      }

      // Estatísticas do bot
      const totalUsers = await prisma.payment.groupBy({
        by: ["telegramChatId"],
        where: { botId: params.id },
        _count: true,
      });

      const totalPixGenerated = await prisma.payment.count({
        where: { 
          botId: params.id,
          status: "paid",
        },
      });

      const paidPayments = await prisma.payment.findMany({
        where: {
          botId: params.id,
          status: "paid",
        },
        select: {
          amount: true,
        },
      });

      const totalRevenue = paidPayments.reduce((sum, payment) => sum + payment.amount, 0);

      const usersWhoPurchased = await prisma.payment.groupBy({
        by: ["telegramChatId"],
        where: {
          botId: params.id,
          status: "paid",
        },
        _count: true,
      });

      return {
        stats: {
          totalUsers: totalUsers.length,
          usersWhoPurchased: usersWhoPurchased.length,
          totalPixGenerated,
          totalRevenue: totalRevenue / 100, // Converter centavos para reais
          totalRevenueCents: totalRevenue,
        },
      };
    } catch (error: any) {
      set.status = 500;
      return { error: error.message || "Erro ao buscar estatísticas" };
    }
  })
  .get("/", async ({ user, set }) => {
    try {
      if (!user) {
        set.status = 401;
        return { error: "Não autorizado" };
      }

      const bots = await prisma.bot.findMany({
        where: { userId: user.id },
        include: {
          paymentButtons: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return { bots };
    } catch (error) {
      set.status = 500;
      return { error: "Erro ao buscar bots" };
    }
  })
  .get("/:id", async ({ user, params, set }) => {
    try {
      if (!user) {
        set.status = 401;
        return { error: "Não autorizado" };
      }

      const bot = await prisma.bot.findUnique({
        where: { id: params.id },
        include: {
          paymentButtons: true,
        },
      });

      if (!bot) {
        set.status = 404;
        return { error: "Bot não encontrado" };
      }

      // Verificar se o bot pertence ao usuário
      if (bot.userId !== user.id) {
        set.status = 403;
        return { error: "Acesso negado" };
      }

      return { bot };
    } catch (error) {
      set.status = 500;
      return { error: "Erro ao buscar bot" };
    }
  })
  .post("/", async ({ user, body, set }) => {
    try {
      if (!user) {
        set.status = 401;
        return { error: "Não autorizado" };
      }

      const {
        name,
        telegramToken,
        syncpayApiKey,
        syncpayApiSecret,
        startImage,
        startCaption,
        resendImage,
        resendCaption,
        resendFirstDelay,
        resendInterval,
        paymentButtons,
        resendPaymentButtons,
        facebookPixelId,
        facebookAccessToken,
        paymentConfirmedMessage,
      } = body as {
        name: string;
        telegramToken: string;
        syncpayApiKey: string;
        syncpayApiSecret: string;
        startImage?: string;
        startCaption?: string;
        resendImage?: string;
        resendCaption?: string;
        resendFirstDelay?: number;
        resendInterval?: number;
        paymentButtons?: Array<{ text: string; value: number }>;
        resendPaymentButtons?: Array<{ text: string; value: number }>;
        facebookPixelId?: string;
        facebookAccessToken?: string;
        paymentConfirmedMessage?: string;
      };

      // Validar campos obrigatórios
      if (!name || !telegramToken || !syncpayApiKey || !syncpayApiSecret) {
        set.status = 400;
        return { error: "Campos obrigatórios faltando" };
      }

      // Criar bot no banco
      const bot = await prisma.bot.create({
        data: {
          userId: user.id,
          name,
          telegramToken,
          syncpayApiKey,
          syncpayApiSecret,
          startImage,
          startCaption,
          resendImage,
          resendCaption,
          resendFirstDelay: resendFirstDelay || 20,
          resendInterval: resendInterval || 10,
          facebookPixelId: facebookPixelId || null,
          facebookAccessToken: facebookAccessToken || null,
          paymentConfirmedMessage: paymentConfirmedMessage || null,
          paymentButtons: {
            create: [
              ...(paymentButtons || []).map((btn) => ({ ...btn, type: "start" })),
              ...(resendPaymentButtons || []).map((btn) => ({ ...btn, type: "resend" })),
            ],
          },
        } as any,
        include: {
          paymentButtons: true,
        },
      }) as any;

      // Iniciar bot no Telegram
      await botManager.startBot(bot.id, bot.telegramToken, {
        syncpayApiKey: bot.syncpayApiKey,
        syncpayApiSecret: bot.syncpayApiSecret,
        startImage: bot.startImage,
        startCaption: bot.startCaption,
        resendImage: bot.resendImage,
        resendCaption: bot.resendCaption,
        resendFirstDelay: bot.resendFirstDelay || 20,
        resendInterval: bot.resendInterval || 10,
        paymentButtons: bot.paymentButtons
          .filter((btn) => btn.type === "start")
          .map((btn) => ({
            text: btn.text,
            value: btn.value,
          })),
        resendPaymentButtons: bot.paymentButtons
          .filter((btn) => btn.type === "resend")
          .map((btn) => ({
            text: btn.text,
            value: btn.value,
          })),
        paymentConfirmedMessage: bot.paymentConfirmedMessage,
      });

      return { bot };
    } catch (error: any) {
      set.status = 500;
      return { error: error.message || "Erro ao criar bot" };
    }
  })
  .put("/:id", async ({ user, params, body, set }) => {
    try {
      if (!user) {
        set.status = 401;
        return { error: "Não autorizado" };
      }

      const {
        name,
        telegramToken,
        syncpayApiKey,
        syncpayApiSecret,
        startImage,
        startCaption,
        resendImage,
        resendCaption,
        resendFirstDelay,
        resendInterval,
        paymentButtons,
        resendPaymentButtons,
        isActive,
        facebookPixelId,
        facebookAccessToken,
        paymentConfirmedMessage,
      } = body as {
        name?: string;
        telegramToken?: string;
        syncpayApiKey?: string;
        syncpayApiSecret?: string;
        startImage?: string;
        startCaption?: string;
        resendImage?: string;
        resendCaption?: string;
        resendFirstDelay?: number;
        resendInterval?: number;
        paymentButtons?: Array<{ text: string; value: number }>;
        resendPaymentButtons?: Array<{ text: string; value: number }>;
        isActive?: boolean;
        facebookPixelId?: string;
        facebookAccessToken?: string;
        paymentConfirmedMessage?: string;
      };

      // Parar bot atual se estiver rodando
      await botManager.stopBot(params.id);

      // Preparar dados de atualização (permitir null para limpar campos)
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (telegramToken !== undefined) updateData.telegramToken = telegramToken;
      if (syncpayApiKey !== undefined) updateData.syncpayApiKey = syncpayApiKey;
      if (syncpayApiSecret !== undefined) updateData.syncpayApiSecret = syncpayApiSecret;
      if (startImage !== undefined) updateData.startImage = (startImage && startImage.trim()) ? startImage.trim() : null;
      if (startCaption !== undefined) updateData.startCaption = (startCaption && startCaption.trim()) ? startCaption.trim() : null;
      if (resendImage !== undefined) updateData.resendImage = (resendImage && resendImage.trim()) ? resendImage.trim() : null;
      if (resendCaption !== undefined) updateData.resendCaption = (resendCaption && resendCaption.trim()) ? resendCaption.trim() : null;
      if (resendFirstDelay !== undefined) updateData.resendFirstDelay = resendFirstDelay;
      if (resendInterval !== undefined) updateData.resendInterval = resendInterval;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (facebookPixelId !== undefined) updateData.facebookPixelId = facebookPixelId || null;
      if (facebookAccessToken !== undefined) updateData.facebookAccessToken = facebookAccessToken || null;
      if (paymentConfirmedMessage !== undefined) updateData.paymentConfirmedMessage = paymentConfirmedMessage || null;

      // Atualizar no banco
      const bot = await prisma.bot.update({
        where: { id: params.id, userId: user.id },
        data: updateData,
        include: {
          paymentButtons: true,
        },
      }) as any;

      // Deletar botões antigos e criar novos
      if (paymentButtons !== undefined || resendPaymentButtons !== undefined) {
        await prisma.paymentButton.deleteMany({
          where: { botId: params.id },
        });

        const buttonsToCreate = [
          ...(paymentButtons || []).map((btn) => ({
            botId: params.id,
            text: btn.text,
            value: btn.value,
            type: "start" as const,
          })),
          ...(resendPaymentButtons || []).map((btn) => ({
            botId: params.id,
            text: btn.text,
            value: btn.value,
            type: "resend" as const,
          })),
        ];

        if (buttonsToCreate.length > 0) {
          await prisma.paymentButton.createMany({
            data: buttonsToCreate,
          });
        }

        bot.paymentButtons = await prisma.paymentButton.findMany({
          where: { botId: params.id },
        });
      }

      // Reiniciar bot se estiver ativo
      if (bot.isActive) {
        await botManager.startBot(bot.id, bot.telegramToken, {
          syncpayApiKey: bot.syncpayApiKey,
          syncpayApiSecret: bot.syncpayApiSecret,
          startImage: bot.startImage,
          startCaption: bot.startCaption,
          resendImage: bot.resendImage,
          resendCaption: bot.resendCaption,
          resendFirstDelay: bot.resendFirstDelay || 20,
          resendInterval: bot.resendInterval || 10,
          paymentButtons: bot.paymentButtons
            .filter((btn) => btn.type === "start")
            .map((btn) => ({
              text: btn.text,
              value: btn.value,
            })),
          resendPaymentButtons: bot.paymentButtons
            .filter((btn) => btn.type === "resend")
            .map((btn) => ({
              text: btn.text,
              value: btn.value,
            })),
          paymentConfirmedMessage: bot.paymentConfirmedMessage,
        });
      }

      return { bot };
    } catch (error: any) {
      set.status = 500;
      return { error: error.message || "Erro ao atualizar bot" };
    }
  })
  .delete("/:id", async ({ user, params, set }) => {
    try {
      if (!user) {
        set.status = 401;
        return { error: "Não autorizado" };
      }

      // Parar bot
      await botManager.stopBot(params.id);

      // Deletar do banco
      await prisma.bot.delete({
        where: { id: params.id, userId: user.id },
      });

      return { message: "Bot deletado com sucesso" };
    } catch (error: any) {
      set.status = 500;
      return { error: error.message || "Erro ao deletar bot" };
    }
  });
