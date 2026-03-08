import { Elysia } from "elysia";
import { PrismaClient } from "@prisma/client";
import { Bot, InputFile } from "grammy";
import { auth } from "../lib/auth";
import { isCloudinaryUrl } from "../services/cloudinary";

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
  // Obter bot manual do usuário
  .get("/", async ({ user, set }) => {
    try {
      const bot = await prisma.bot.findFirst({
        where: {
          userId: user.id,
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
      } = body as any;

      if (!name || !telegramToken || !syncpayApiKey || !syncpayApiSecret) {
        set.status = 400;
        return { error: "Nome, token do Telegram e credenciais da SyncPay são obrigatórios" };
      }

      // Verificar se já existe bot manual
      const existingBot = await prisma.bot.findFirst({
        where: {
          userId: user.id,
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
            userId: user.id,
            name,
            telegramToken,
            syncpayApiKey,
            syncpayApiSecret,
            startImage: startImage || null,
            startCaption: startCaption || null,
            startButtonMessage: startButtonMessage || null,
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
          userId: user.id,
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
  // Disparar mensagens para todos os leads
  .post("/send", async ({ user, set }) => {
    try {
      // Buscar bot manual
      const bot = await prisma.bot.findFirst({
        where: {
          userId: user.id,
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

      // Buscar todos os leads de todos os bots do usuário
      const userBots = await prisma.bot.findMany({
        where: { userId: user.id },
        select: { id: true },
      });

      const botIds = userBots.map((b) => b.id);

      if (botIds.length === 0) {
        return { 
          sent: 0, 
          blocked: 0, 
          errors: 0,
          message: "Nenhum bot encontrado" 
        };
      }

      // Buscar todos os leads únicos (por telegramChatId)
      const allLeads = await prisma.lead.findMany({
        where: {
          botId: { in: botIds },
        },
        select: {
          telegramChatId: true,
          telegramUsername: true,
          firstName: true,
          lastName: true,
        },
        distinct: ["telegramChatId"],
      });

      // Buscar leads bloqueados do bot manual
      const blockedLeads = await prisma.manualBotBlockedLead.findMany({
        where: { botId: bot.id },
        select: { telegramChatId: true },
      });

      const blockedChatIds = new Set(blockedLeads.map((l) => l.telegramChatId));

      // Filtrar leads não bloqueados
      const leadsToSend = allLeads.filter(
        (lead) => !blockedChatIds.has(lead.telegramChatId)
      );

      // Criar instância do bot do Telegram
      const telegramBot = new Bot(bot.telegramToken);

      // Preparar botões
      let keyboard: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } | undefined = undefined;
      if (bot.paymentButtons && bot.paymentButtons.length > 0) {
        keyboard = {
          inline_keyboard: bot.paymentButtons.map((btn) => [
            {
              text: formatButtonText(btn),
              callback_data: `payment_${btn.value}`,
            },
          ]),
        };
      }

      const caption = (bot.startCaption || "").replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const hasButtonMessage = bot.startButtonMessage && bot.startButtonMessage.trim().length > 0;
      const buttonMessage = bot.startButtonMessage || undefined;

      let sent = 0;
      let blocked = 0;
      let errors = 0;

      // Enviar mensagens
      for (const lead of leadsToSend) {
        try {
          if (bot.startImage) {
            const isVideo = isVideoUrl(bot.startImage);
            const media = await getMediaInput(bot.startImage);
            
            // Se há mensagem específica para botões, enviar mídia sem botões e depois mensagem separada
            const replyMarkup = hasButtonMessage ? undefined : keyboard;
            
            if (typeof media === 'string') {
              if (isVideo) {
                await telegramBot.api.sendVideo(parseInt(lead.telegramChatId), media, {
                  caption: caption,
                  reply_markup: replyMarkup,
                  parse_mode: undefined,
                });
              } else {
                await telegramBot.api.sendPhoto(parseInt(lead.telegramChatId), media, {
                  caption: caption,
                  reply_markup: replyMarkup,
                  parse_mode: undefined,
                });
              }
            } else {
              // Media é um InputFile
              if (isVideo) {
                await telegramBot.api.sendVideo(parseInt(lead.telegramChatId), media, {
                  caption: caption,
                  reply_markup: replyMarkup,
                  parse_mode: undefined,
                });
              } else {
                await telegramBot.api.sendPhoto(parseInt(lead.telegramChatId), media, {
                  caption: caption,
                  reply_markup: replyMarkup,
                  parse_mode: undefined,
                });
              }
            }

            // Se há mensagem específica para botões, enviar mensagem separada com os botões
            if (hasButtonMessage && keyboard && buttonMessage) {
              const formattedButtonMessage = buttonMessage.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
              await telegramBot.api.sendMessage(parseInt(lead.telegramChatId), formattedButtonMessage, {
                reply_markup: keyboard,
                parse_mode: undefined,
              });
            }
          } else {
            // Enviar apenas texto
            const messageText = caption || buttonMessage || "Olá!";
            await telegramBot.api.sendMessage(parseInt(lead.telegramChatId), messageText, {
              reply_markup: keyboard,
              parse_mode: undefined,
            });
          }

          sent++;
          
          // Pequeno delay para evitar rate limit
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error: any) {
          const errorCode = error?.error_code || error?.error?.error_code;
          const errorDesc = (error?.description || error?.error?.description || error?.message || "").toLowerCase();
          
          // Verificar se é erro de bloqueio
          if (
            errorCode === 403 ||
            errorDesc.includes("bot was blocked") ||
            errorDesc.includes("chat not found") ||
            errorDesc.includes("user is deactivated") ||
            errorDesc.includes("forbidden") ||
            errorDesc.includes("blocked")
          ) {
            // Adicionar à lista de bloqueados
            try {
              await prisma.manualBotBlockedLead.upsert({
                where: {
                  botId_telegramChatId: {
                    botId: bot.id,
                    telegramChatId: lead.telegramChatId,
                  },
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

      return {
        sent,
        blocked,
        errors,
        total: leadsToSend.length,
        message: `Enviado: ${sent}, Bloqueados: ${blocked}, Erros: ${errors}`,
      };
    } catch (error: any) {
      set.status = 500;
      return { error: error.message || "Erro ao disparar mensagens" };
    }
  })
  // Listar leads bloqueados
  .get("/blocked", async ({ user, set }) => {
    try {
      const bot = await prisma.bot.findFirst({
        where: {
          userId: user.id,
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
          userId: user.id,
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
