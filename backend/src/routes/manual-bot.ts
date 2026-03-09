import { Elysia } from "elysia";
import { PrismaClient } from "@prisma/client";
import { Bot, InputFile } from "grammy";
import { randomUUID } from "crypto";
import { auth } from "../lib/auth";
import { isCloudinaryUrl } from "../services/cloudinary";
import {
  setSendJob,
  setSendResult,
  setSendError,
  getSendResult,
} from "../services/manual-bot-send";

const prisma = new PrismaClient();

// Função auxiliar para formatar o texto do botão com preço antes do texto
function formatButtonText(btn: { text: string; value: number }): string {
  const price = (btn.value / 100).toFixed(2).replace('.', ',');
  return `R$ ${price} - ${btn.text}`;
}

// Função auxiliar para verificar se é vídeo
function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogg|mov)$/i.test(url);
}

// Função auxiliar para obter media input
async function getMediaInput(mediaUrl: string): Promise<string | InputFile> {
  if (isCloudinaryUrl(mediaUrl)) {
    return mediaUrl;
  }
  
  if (mediaUrl.startsWith("http://") || mediaUrl.startsWith("https://")) {
    return mediaUrl;
  }
  
  try {
    const response = await fetch(mediaUrl);
    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      const fileName = mediaUrl.split("/").pop()?.split("?")[0] || "media.jpg";
      return new InputFile(Buffer.from(arrayBuffer), fileName);
    } else {
      return mediaUrl;
    }
  } catch (error) {
    return mediaUrl;
  }
}

async function runManualBotSend(userId: string, jobId: string) {
  try {
    const bot = await prisma.bot.findFirst({
      where: { userId, isManual: true },
      include: {
        paymentButtons: { where: { type: "start" }, orderBy: { createdAt: "asc" } },
      },
    });

    if (!bot) {
      setSendError(jobId, userId, "Bot manual não encontrado");
      return;
    }

    const userBots = await prisma.bot.findMany({
      where: { userId },
      select: { id: true },
    });
    const botIds = userBots.map((b) => b.id);

    if (botIds.length === 0) {
      setSendResult(jobId, userId, { sent: 0, blocked: 0, errors: 0, total: 0 });
      return;
    }

    const allLeads = await prisma.lead.findMany({
      where: { botId: { in: botIds } },
      select: {
        telegramChatId: true,
        telegramUsername: true,
        firstName: true,
        lastName: true,
      },
      distinct: ["telegramChatId"],
    });

    const blockedLeads = await prisma.manualBotBlockedLead.findMany({
      where: { botId: bot.id },
      select: { telegramChatId: true },
    });
    const blockedChatIds = new Set(blockedLeads.map((l) => l.telegramChatId));
    const leadsToSend = allLeads.filter((l) => !blockedChatIds.has(l.telegramChatId));

    const telegramBot = new Bot(bot.telegramToken);
    let keyboard: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } | undefined;
    if (bot.paymentButtons?.length) {
      keyboard = {
        inline_keyboard: bot.paymentButtons.map((btn) => [
          { text: formatButtonText(btn), callback_data: `payment_${btn.value}` },
        ]),
      };
    }

    const caption = (bot.startCaption || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const hasButtonMessage = !!(bot.startButtonMessage?.trim());
    const buttonMessage = bot.startButtonMessage || undefined;

    let sent = 0,
      blocked = 0,
      errors = 0;

    for (const lead of leadsToSend) {
      try {
        if (bot.startImage) {
          const isVideo = isVideoUrl(bot.startImage);
          const media = await getMediaInput(bot.startImage);
          const replyMarkup = hasButtonMessage ? undefined : keyboard;

          if (typeof media === "string") {
            if (isVideo) {
              await telegramBot.api.sendVideo(parseInt(lead.telegramChatId), media, {
                caption,
                reply_markup: replyMarkup,
                parse_mode: undefined,
              });
            } else {
              await telegramBot.api.sendPhoto(parseInt(lead.telegramChatId), media, {
                caption,
                reply_markup: replyMarkup,
                parse_mode: undefined,
              });
            }
          } else {
            if (isVideo) {
              await telegramBot.api.sendVideo(parseInt(lead.telegramChatId), media, {
                caption,
                reply_markup: replyMarkup,
                parse_mode: undefined,
              });
            } else {
              await telegramBot.api.sendPhoto(parseInt(lead.telegramChatId), media, {
                caption,
                reply_markup: replyMarkup,
                parse_mode: undefined,
              });
            }
          }

          if (hasButtonMessage && keyboard && buttonMessage) {
            const formatted = buttonMessage.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
            await telegramBot.api.sendMessage(parseInt(lead.telegramChatId), formatted, {
              reply_markup: keyboard,
              parse_mode: undefined,
            });
          }
        } else {
          const messageText = caption || buttonMessage || "Olá!";
          await telegramBot.api.sendMessage(parseInt(lead.telegramChatId), messageText, {
            reply_markup: keyboard,
            parse_mode: undefined,
          });
        }
        sent++;
        await new Promise((r) => setTimeout(r, 100));
      } catch (error: any) {
        const errorCode = error?.error_code || error?.error?.error_code;
        const errorDesc = (error?.description || error?.error?.description || error?.message || "").toLowerCase();
        if (
          errorCode === 403 ||
          errorDesc.includes("bot was blocked") ||
          errorDesc.includes("chat not found") ||
          errorDesc.includes("user is deactivated") ||
          errorDesc.includes("forbidden") ||
          errorDesc.includes("blocked")
        ) {
          try {
            await prisma.manualBotBlockedLead.upsert({
              where: {
                botId_telegramChatId: { botId: bot.id, telegramChatId: lead.telegramChatId },
              },
              create: {
                botId: bot.id,
                telegramChatId: lead.telegramChatId,
                telegramUsername: lead.telegramUsername || null,
                firstName: lead.firstName || null,
                lastName: lead.lastName || null,
              },
              update: {},
            });
            blocked++;
          } catch (dbError) {
            console.error("Erro ao salvar lead bloqueado:", dbError);
          }
        } else {
          errors++;
          console.error(`Erro ao enviar para ${lead.telegramChatId}:`, error);
        }
      }
    }

    setSendResult(jobId, userId, { sent, blocked, errors, total: leadsToSend.length });
  } catch (error: any) {
    console.error("[ManualBotSend] Erro:", error);
    setSendError(jobId, userId, error.message || "Erro ao enviar mensagens");
  }
}

export const manualBotRoutes = new Elysia({ prefix: "/api/manual-bot" })
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
  // Estatísticas do bot manual (total de leads que deram /start)
  .get("/stats", async ({ user, set }) => {
    try {
      const userBots = await prisma.bot.findMany({
        where: { userId: user!.id },
        select: { id: true },
      });
      const botIds = userBots.map((b) => b.id);

      if (botIds.length === 0) {
        return { totalLeads: 0 };
      }

      const uniqueLeads = await prisma.lead.findMany({
        where: { botId: { in: botIds } },
        select: { telegramChatId: true },
        distinct: ["telegramChatId"],
      });
      const totalLeads = uniqueLeads.length;

      return { totalLeads };
    } catch (error: any) {
      set.status = 500;
      return { error: error.message || "Erro ao buscar estatísticas" };
    }
  })
  // Obter bot manual do usuário
  .get("/", async ({ user, set }) => {
    try {
      const bot = await prisma.bot.findFirst({
        where: {
          userId: user!.id,
          isManual: true,
        },
        include: {
          paymentButtons: {
            where: { type: "start" },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!bot) {
        return { bot: null };
      }

      return { bot };
    } catch (error: any) {
      set.status = 500;
      return { error: error.message || "Erro ao buscar bot manual" };
    }
  })
  // Criar ou atualizar bot manual
  .post("/", async ({ user, body, set }) => {
    try {
      const {
        name,
        telegramToken,
        syncpayApiKey,
        syncpayApiSecret,
        startImage,
        startCaption,
        startButtonMessage,
        paymentButtons,
        paymentConfirmedMessage,
      } = body as any;

      if (!name || !telegramToken || !syncpayApiKey || !syncpayApiSecret) {
        set.status = 400;
        return { error: "Nome, token do Telegram e credenciais da SyncPay são obrigatórios" };
      }

      // Verificar se já existe bot manual
      const existingBot = await prisma.bot.findFirst({
        where: {
          userId: user!.id,
          isManual: true,
        },
      });

      let bot;
      if (existingBot) {
        // Atualizar bot existente
        bot = await prisma.bot.update({
          where: { id: existingBot.id },
          data: {
            name,
            telegramToken,
            syncpayApiKey,
            syncpayApiSecret,
            startImage: startImage || null,
            startCaption: startCaption || null,
            startButtonMessage: startButtonMessage || null,
            paymentConfirmedMessage: paymentConfirmedMessage || null,
            paymentButtons: {
              deleteMany: { type: "start" },
              create: (paymentButtons || []).map((btn: any) => ({
                text: btn.text,
                value: btn.value,
                type: "start",
              })),
            },
          },
          include: {
            paymentButtons: {
              where: { type: "start" },
              orderBy: { createdAt: "asc" },
            },
          },
        });
      } else {
        // Criar novo bot manual
        bot = await prisma.bot.create({
          data: {
            userId: user!.id,
            name,
            telegramToken,
            syncpayApiKey,
            syncpayApiSecret,
            startImage: startImage || null,
            startCaption: startCaption || null,
            startButtonMessage: startButtonMessage || null,
            paymentConfirmedMessage: paymentConfirmedMessage || null,
            isManual: true,
            isActive: false, // Bot manual não precisa estar ativo
            paymentButtons: {
              create: (paymentButtons || []).map((btn: any) => ({
                text: btn.text,
                value: btn.value,
                type: "start",
              })),
            },
          },
          include: {
            paymentButtons: {
              where: { type: "start" },
              orderBy: { createdAt: "asc" },
            },
          },
        });
      }

      return { bot };
    } catch (error: any) {
      set.status = 500;
      return { error: error.message || "Erro ao criar/atualizar bot manual" };
    }
  })
  // Trocar token do bot manual
  .put("/token", async ({ user, body, set }) => {
    try {
      const { telegramToken } = body as any;

      if (!telegramToken) {
        set.status = 400;
        return { error: "Token do Telegram é obrigatório" };
      }

      const bot = await prisma.bot.findFirst({
        where: {
          userId: user!.id,
          isManual: true,
        },
      });

      if (!bot) {
        set.status = 404;
        return { error: "Bot manual não encontrado" };
      }

      const updatedBot = await prisma.bot.update({
        where: { id: bot.id },
        data: {
          telegramToken,
        },
      });

      return { bot: updatedBot };
    } catch (error: any) {
      set.status = 500;
      return { error: error.message || "Erro ao atualizar token" };
    }
  })
  // Disparar mensagens para todos os leads (em background para evitar timeout)
  .post("/send", async ({ user, set }) => {
    try {
      const bot = await prisma.bot.findFirst({
        where: {
          userId: user!.id,
          isManual: true,
        },
        include: {
          paymentButtons: {
            where: { type: "start" },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!bot) {
        set.status = 404;
        return { error: "Bot manual não encontrado" };
      }

      const jobId = randomUUID();
      setSendJob(jobId, user!.id);

      // Executar em background para evitar timeout 502
      setImmediate(() => runManualBotSend(user!.id, jobId));

      set.status = 202;
      return { jobId, message: "Envio iniciado em background" };
    } catch (error: any) {
      set.status = 500;
      return { error: error.message || "Erro ao disparar mensagens" };
    }
  })
  // Consultar status do envio
  .get("/send/status/:jobId", async ({ user, params, set }) => {
    try {
      const data = getSendResult(params.jobId, user!.id);
      if (!data) {
        set.status = 404;
        return { error: "Job não encontrado ou expirado" };
      }
      if (data.status === "processing") {
        return { status: "processing" };
      }
      if (data.status === "error") {
        return { status: "error", error: data.error };
      }
      return {
        status: "completed",
        sent: data.sent,
        blocked: data.blocked,
        errors: data.errors,
        total: data.total,
      };
    } catch (error: any) {
      set.status = 500;
      return { error: error.message || "Erro ao consultar status" };
    }
  })
  // Listar leads bloqueados
  .get("/blocked", async ({ user, set }) => {
    try {
      const bot = await prisma.bot.findFirst({
        where: {
          userId: user!.id,
          isManual: true,
        },
      });

      if (!bot) {
        return { blockedLeads: [] };
      }

      const blockedLeads = await prisma.manualBotBlockedLead.findMany({
        where: { botId: bot.id },
        orderBy: { blockedAt: "desc" },
      });

      return { blockedLeads };
    } catch (error: any) {
      set.status = 500;
      return { error: error.message || "Erro ao buscar leads bloqueados" };
    }
  })
  // Remover lead da lista de bloqueados
  .delete("/blocked/:chatId", async ({ user, params, set }) => {
    try {
      const bot = await prisma.bot.findFirst({
        where: {
          userId: user!.id,
          isManual: true,
        },
      });

      if (!bot) {
        set.status = 404;
        return { error: "Bot manual não encontrado" };
      }

      await prisma.manualBotBlockedLead.deleteMany({
        where: {
          botId: bot.id,
          telegramChatId: params.chatId,
        },
      });

      return { success: true };
    } catch (error: any) {
      set.status = 500;
      return { error: error.message || "Erro ao remover lead bloqueado" };
    }
  });
