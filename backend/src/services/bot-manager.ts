import { Bot, Context, InputFile } from "grammy";
import { PrismaClient } from "@prisma/client";
import { SyncPayService } from "./syncpay";
import { TrackingStorage } from "./tracking-storage";
import { scheduleResends, removeResendJobs } from "./resend-queue";
import { isCloudinaryUrl } from "./cloudinary";

const prisma = new PrismaClient();

interface BotConfig {
  syncpayApiKey: string;
  syncpayApiSecret: string;
  startImage?: string | null;
  startCaption?: string | null;
  startButtonMessage?: string | null; // Mensagem separada para os botões (se não houver, usa botões na caption)
  resendImage?: string | null;
  resendCaption?: string | null;
  resendButtonMessage?: string | null; // Mensagem separada para os botões de reenvio (se não houver, usa botões na caption)
  resendImages?: string[];
  resendCaptions?: string[]; // Múltiplos textos para rotação
  resendFirstDelay?: number;
  resendInterval?: number;
  paymentButtons: Array<{ text: string; value: number }>;
  resendPaymentButtons?: Array<{ text: string; value: number }>;
  resendButtonGroups?: Array<Array<{ text: string; value: number }>>; // Grupos de botões para rotação
  paymentConfirmedMessage?: string | null;
}

export class BotManager {
  private static instance: BotManager;
  private bots: Map<string, Bot> = new Map();
  private botConfigs: Map<string, BotConfig> = new Map();

  // Função auxiliar para formatar o texto do botão com preço antes do texto
  private formatButtonText(btn: { text: string; value: number }): string {
    const price = (btn.value / 100).toFixed(2).replace('.', ',');
    return `R$ ${price} - ${btn.text}`;
  }
  private resendTimers: Map<string, Map<string, NodeJS.Timeout>> = new Map();

  private constructor() {}

  static getInstance(): BotManager {
    if (!BotManager.instance) {
      BotManager.instance = new BotManager();
    }
    return BotManager.instance;
  }

  private isVideoUrl(url: string): boolean {
    return /\.(mp4|webm|ogg|mov)$/i.test(url);
  }

  private isBlockedError(error: any): boolean {
    const errorCode = error?.error_code || error?.error?.error_code;
    const errorDesc = (error?.description || error?.error?.description || error?.message || "").toLowerCase();
    
    // Códigos de erro do Telegram quando usuário bloqueia o bot
    // 403: Forbidden - usuário bloqueou o bot
    // 400 com "chat not found" ou "bot was blocked"
    return (
      errorCode === 403 ||
      errorDesc.includes("bot was blocked") ||
      errorDesc.includes("chat not found") ||
      errorDesc.includes("user is deactivated") ||
      errorDesc.includes("forbidden") ||
      errorDesc.includes("blocked")
    );
  }

  private async getMediaInput(mediaUrl: string): Promise<string | InputFile> {
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

  async startBot(botId: string, token: string, config: BotConfig) {
    await this.stopBot(botId);
    await new Promise(resolve => setTimeout(resolve, 5000));

    const bot = new Bot(token);
    const syncpay = new SyncPayService(config.syncpayApiKey, config.syncpayApiSecret);
    
    bot.catch(async (error) => {
      const errorCode = (error as any).error_code || (error as any).error?.error_code;
      const errorDesc = (error as any).description || (error as any).error?.description || (error as any).message || '';
      
      if (errorCode === 409 || errorDesc.includes('409') || errorDesc.includes('Conflict')) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        await this.stopBot(botId).catch(() => {});
      } else if (errorCode === 403 || errorDesc.includes('bot was blocked') || errorDesc.includes('forbidden')) {
        // Usuário bloqueou o bot - não logar (comportamento esperado)
      } else {
        console.error(`[Bot ${botId}] Erro não tratado:`, error);
      }
    });

    const sendStartMessage = async (chatId: string): Promise<boolean> => {
      let keyboard: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } | undefined = undefined;
      if (config.paymentButtons && config.paymentButtons.length > 0) {
        keyboard = {
          inline_keyboard: config.paymentButtons.map((btn) => [
            {
              text: this.formatButtonText(btn),
              callback_data: `payment_${btn.value}`,
            },
          ]),
        };
      }

      const caption = (config.startCaption || "Bem-vindo!").replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const hasButtonMessage = config.startButtonMessage && config.startButtonMessage.trim().length > 0;
      
      if (config.startImage) {
        try {
          const isVideo = this.isVideoUrl(config.startImage);
          const media = await this.getMediaInput(config.startImage);
          
          // Se há mensagem específica para botões, enviar mídia sem botões e depois mensagem separada
          const replyMarkup = hasButtonMessage ? undefined : keyboard;
          
          if (typeof media === 'string') {
            if (isVideo) {
              await bot.api.sendVideo(parseInt(chatId), media, {
                caption: caption,
                reply_markup: replyMarkup,
                parse_mode: undefined,
              });
            } else {
              await bot.api.sendPhoto(parseInt(chatId), media, {
                caption: caption,
                reply_markup: replyMarkup,
                parse_mode: undefined,
              });
            }
          } else {
            // Media é um InputFile
            if (isVideo) {
              await bot.api.sendVideo(parseInt(chatId), media, {
                caption: caption,
                reply_markup: replyMarkup,
                parse_mode: undefined,
              });
            } else {
              await bot.api.sendPhoto(parseInt(chatId), media, {
                caption: caption,
                reply_markup: replyMarkup,
                parse_mode: undefined,
              });
            }
          }
          
          // Se há mensagem específica para botões, enviar mensagem separada com os botões
          if (hasButtonMessage && keyboard) {
            const buttonMessage = config.startButtonMessage!.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            await bot.api.sendMessage(parseInt(chatId), buttonMessage, {
              reply_markup: keyboard,
              parse_mode: undefined,
            });
          }
        } catch (error: any) {
          // Verificar se é erro de bloqueio
          const isBlockedError = this.isBlockedError(error);
          if (isBlockedError) {
            // Tentar atualizar lead se existir
            try {
              const lead = await prisma.lead.findFirst({
                where: {
                  botId,
                  telegramChatId: chatId,
                },
              });
              if (lead) {
                await prisma.lead.update({
                  where: { id: lead.id },
                  data: { isBlocked: true },
                });
              }
            } catch (leadError) {
              // Ignorar erro ao atualizar lead
            }
            return false; // Usuário bloqueou o bot - não propagar erro
          }
          // Se não for bloqueio, tentar enviar apenas texto
          try {
            await bot.api.sendMessage(parseInt(chatId), caption, {
              reply_markup: keyboard,
              parse_mode: undefined,
            });
            // Se há mensagem específica para botões, enviar mensagem separada
            if (hasButtonMessage && keyboard) {
              const buttonMessage = config.startButtonMessage!.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
              await bot.api.sendMessage(parseInt(chatId), buttonMessage, {
                reply_markup: keyboard,
                parse_mode: undefined,
              });
            }
          } catch (messageError: any) {
            const isBlockedError2 = this.isBlockedError(messageError);
            if (isBlockedError2) {
              try {
                const lead = await prisma.lead.findFirst({
                  where: {
                    botId,
                    telegramChatId: chatId,
                  },
                });
                if (lead) {
                  await prisma.lead.update({
                    where: { id: lead.id },
                    data: { isBlocked: true },
                  });
                }
              } catch (leadError) {
                // Ignorar erro ao atualizar lead
              }
              return false; // Usuário bloqueou o bot - não propagar erro
            }
            throw messageError;
          }
        }
      } else {
        const message = hasButtonMessage ? caption : caption;
        try {
          await bot.api.sendMessage(parseInt(chatId), message, {
            reply_markup: hasButtonMessage ? undefined : keyboard,
            parse_mode: undefined,
          });
          // Se há mensagem específica para botões, enviar mensagem separada
          if (hasButtonMessage && keyboard) {
            const buttonMessage = config.startButtonMessage!.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            await bot.api.sendMessage(parseInt(chatId), buttonMessage, {
              reply_markup: keyboard,
              parse_mode: undefined,
            });
          }
        } catch (error: any) {
          // Verificar se é erro de bloqueio
          const isBlockedError = this.isBlockedError(error);
          if (isBlockedError) {
            try {
              const lead = await prisma.lead.findFirst({
                where: {
                  botId,
                  telegramChatId: chatId,
                },
              });
              if (lead) {
                await prisma.lead.update({
                  where: { id: lead.id },
                  data: { isBlocked: true },
                });
              }
            } catch (leadError) {
              // Ignorar erro ao atualizar lead
            }
            return false; // Usuário bloqueou o bot - não propagar erro
          }
          throw error;
        }
      }
      return true;
    };

    const sendResendMessage = async (chatId: string) => {
      let keyboard: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } | undefined = undefined;
      const buttonsToUse = config.resendPaymentButtons && config.resendPaymentButtons.length > 0 
        ? config.resendPaymentButtons 
        : config.paymentButtons;
      
      if (buttonsToUse && buttonsToUse.length > 0) {
        keyboard = {
          inline_keyboard: buttonsToUse.map((btn) => [
            {
              text: this.formatButtonText(btn),
              callback_data: `payment_${btn.value}`,
            },
          ]),
        };
      }

      const mediaUrl = config.resendImage || config.startImage;
      const captionText = (config.resendCaption || config.startCaption || "Bem-vindo!").replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const hasButtonMessage = config.resendButtonMessage && config.resendButtonMessage.trim().length > 0;

      if (mediaUrl) {
        try {
          const isVideo = this.isVideoUrl(mediaUrl);
          const media = await this.getMediaInput(mediaUrl);
          
          // Se há mensagem específica para botões, enviar mídia sem botões e depois mensagem separada
          const replyMarkup = hasButtonMessage ? undefined : keyboard;
          
          if (typeof media === 'string') {
            if (isVideo) {
              await bot.api.sendVideo(parseInt(chatId), media, {
                caption: captionText,
                reply_markup: replyMarkup,
                parse_mode: undefined,
              });
            } else {
              await bot.api.sendPhoto(parseInt(chatId), media, {
                caption: captionText,
                reply_markup: replyMarkup,
                parse_mode: undefined,
              });
            }
          } else {
            // Media é um InputFile
            if (isVideo) {
              await bot.api.sendVideo(parseInt(chatId), media, {
                caption: captionText,
                reply_markup: replyMarkup,
                parse_mode: undefined,
              });
            } else {
              await bot.api.sendPhoto(parseInt(chatId), media, {
                caption: captionText,
                reply_markup: replyMarkup,
                parse_mode: undefined,
              });
            }
          }
          
          // Se há mensagem específica para botões, enviar mensagem separada com os botões
          if (hasButtonMessage && keyboard) {
            const buttonMessage = config.resendButtonMessage!.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            await bot.api.sendMessage(parseInt(chatId), buttonMessage, {
              reply_markup: keyboard,
              parse_mode: undefined,
            });
          }
        } catch (error) {
          await bot.api.sendMessage(parseInt(chatId), captionText, {
            reply_markup: hasButtonMessage ? undefined : keyboard,
            parse_mode: undefined,
          });
          // Se há mensagem específica para botões, enviar mensagem separada
          if (hasButtonMessage && keyboard) {
            const buttonMessage = config.resendButtonMessage!.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            await bot.api.sendMessage(parseInt(chatId), buttonMessage, {
              reply_markup: keyboard,
              parse_mode: undefined,
            });
          }
        }
      } else {
        await bot.api.sendMessage(parseInt(chatId), captionText, {
          reply_markup: hasButtonMessage ? undefined : keyboard,
          parse_mode: undefined,
        });
        // Se há mensagem específica para botões, enviar mensagem separada
        if (hasButtonMessage && keyboard) {
          const buttonMessage = config.resendButtonMessage!.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
          await bot.api.sendMessage(parseInt(chatId), buttonMessage, {
            reply_markup: keyboard,
            parse_mode: undefined,
          });
        }
      }
    };

    const hasUserPurchased = async (chatId: string): Promise<boolean> => {
      const paidPayment = await prisma.payment.findFirst({
        where: {
          botId,
          telegramChatId: chatId,
          status: "paid",
        },
      });
      return !!paidPayment;
    };

    const startResendSchedule = async (chatId: string) => {
      await this.stopResendSchedule(botId, chatId);

      const lead = await prisma.lead.findFirst({
        where: {
          botId,
          telegramChatId: chatId,
        },
      });

      if ((lead as any)?.resendPaused) {
        return;
      }

      await scheduleResends(
        botId,
        chatId,
        config.resendFirstDelay || 20,
        config.resendInterval || 10
      );
    };

    const extractTrackingParams = async (startParam?: string) => {
      const params: {
        utmSource?: string;
        utmMedium?: string;
        utmCampaign?: string;
        utmContent?: string;
        utmTerm?: string;
        fbclid?: string;
        gclid?: string;
        ref?: string;
      } = {};

      if (!startParam) return params;

      const trackingStorage = TrackingStorage.getInstance();
      const storedParams = trackingStorage.retrieve(startParam);
      
      if (storedParams) {
        return storedParams;
      }

      if (startParam.includes('=')) {
        const pairs = startParam.split('&');
        for (const pair of pairs) {
          const [key, value] = pair.split('=').map(s => decodeURIComponent(s));
          switch (key) {
            case 'utm_source':
              params.utmSource = value;
              break;
            case 'utm_medium':
              params.utmMedium = value;
              break;
            case 'utm_campaign':
              params.utmCampaign = value;
              break;
            case 'utm_content':
              params.utmContent = value;
              break;
            case 'utm_term':
              params.utmTerm = value;
              break;
            case 'fbclid':
              params.fbclid = value;
              break;
            case 'gclid':
              params.gclid = value;
              break;
            case 'ref':
              params.ref = value;
              break;
          }
        }
      } else {
        params.ref = startParam;
      }

      return params;
    };

    bot.command("start", async (ctx: Context) => {
      try {
        const chatId = ctx.chat?.id.toString();
        if (!chatId) {
          await ctx.reply("Erro: Chat não encontrado.");
          return;
        }

        const startParam = ctx.message?.text?.split(' ')[1];
        const trackingParams = await extractTrackingParams(startParam);
        
        const hasTrackingParams = !!(
          trackingParams.utmSource ||
          trackingParams.utmMedium ||
          trackingParams.utmCampaign ||
          trackingParams.utmContent ||
          trackingParams.utmTerm ||
          trackingParams.fbclid ||
          trackingParams.gclid ||
          trackingParams.ref
        );

        try {
          const user = ctx.from;
          const existingLead = await prisma.lead.findFirst({
            where: {
              botId,
              telegramChatId: chatId,
            },
          });

          if (existingLead) {
            const updateData: any = {
              telegramUsername: user?.username || undefined,
              firstName: user?.first_name || undefined,
              lastName: user?.last_name || undefined,
              isNew: true,
            };

            if (hasTrackingParams) {
              if (trackingParams.utmSource !== undefined) {
                updateData.utmSource = trackingParams.utmSource;
              }
              if (trackingParams.utmMedium !== undefined) {
                updateData.utmMedium = trackingParams.utmMedium;
              }
              if (trackingParams.utmCampaign !== undefined) {
                updateData.utmCampaign = trackingParams.utmCampaign;
              }
              if (trackingParams.utmContent !== undefined) {
                updateData.utmContent = trackingParams.utmContent;
              }
              if (trackingParams.utmTerm !== undefined) {
                updateData.utmTerm = trackingParams.utmTerm;
              }
              if (trackingParams.fbclid !== undefined) {
                updateData.fbclid = trackingParams.fbclid;
              }
              if (trackingParams.gclid !== undefined) {
                updateData.gclid = trackingParams.gclid;
              }
              if (trackingParams.ref !== undefined) {
                updateData.ref = trackingParams.ref;
              }
            }

            await prisma.lead.update({
              where: { id: existingLead.id },
              data: updateData,
            });
          } else {
            await prisma.lead.create({
              data: {
                botId,
                telegramChatId: chatId,
                telegramUsername: user?.username || undefined,
                firstName: user?.first_name || undefined,
                lastName: user?.last_name || undefined,
                isNew: true,
                utmSource: trackingParams.utmSource,
                utmMedium: trackingParams.utmMedium,
                utmCampaign: trackingParams.utmCampaign,
                utmContent: trackingParams.utmContent,
                utmTerm: trackingParams.utmTerm,
                fbclid: trackingParams.fbclid,
                gclid: trackingParams.gclid,
                ref: trackingParams.ref,
              },
            });
          }
        } catch (leadError) {
          // Ignorar erro ao criar lead
        }

        const hasPurchased = await hasUserPurchased(chatId);
        const sent = await sendStartMessage(chatId);

        // Não agendar reenvios se o usuário bloqueou o bot
        if (sent && !hasPurchased) {
          await startResendSchedule(chatId);
        }
      } catch (error) {
        console.error(`Erro no comando /start:`, error);
        try {
          await ctx.reply("❌ Erro ao processar comando. Tente novamente.");
        } catch (replyError) {
          // Ignorar erro ao enviar mensagem de erro
        }
      }
    });

    bot.callbackQuery(/^payment_(\d+)$/, async (ctx: Context) => {
      try {
        if (!ctx.callbackQuery) return;
        const match = ctx.callbackQuery.data?.match(/^payment_(\d+)$/);
        if (!match) return;

        const amount = parseInt(match[1]);
        const chatId = ctx.chat?.id.toString();

        if (!chatId) {
          await ctx.answerCallbackQuery("Erro: Chat não encontrado");
          return;
        }

        await ctx.answerCallbackQuery("Gerando PIX...");

        const payment = await prisma.payment.create({
          data: {
            botId,
            telegramChatId: chatId,
            amount,
            status: "pending",
          },
        });

        const webhookUrl = process.env.WEBHOOK_URL 
          ? `${process.env.WEBHOOK_URL}/api/webhooks/syncpay`
          : process.env.BETTER_AUTH_URL
          ? `${process.env.BETTER_AUTH_URL}/api/webhooks/syncpay`
          : process.env.API_URL
          ? `${process.env.API_URL}/api/webhooks/syncpay`
          : undefined;

        const pixData = await syncpay.createPix(amount, {
          description: `Pagamento via Telegram Bot - ${botId}`,
          webhookUrl: webhookUrl,
          externalReference: payment.id,
        });

        if (!pixData) {
          await ctx.reply("Erro ao gerar PIX. Tente novamente.");
          return;
        }

        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            syncpayId: pixData.id,
            pixCode: pixData.pixCode,
            qrCode: pixData.qrCode,
            expiresAt: pixData.expiresAt,
          },
        });

        const message = `💰 PIX Gerado!\n\n` +
          `Valor: R$ ${(amount / 100).toFixed(2)}\n\n` +
          `Código PIX:\n\`${pixData.pixCode}\`\n\n` +
          `Escaneie o QR Code abaixo ou copie o código.`;

        if (pixData.qrCode) {
          await ctx.replyWithPhoto(pixData.qrCode, {
            caption: message,
            parse_mode: "Markdown",
          });
        } else {
          await ctx.reply(message, { parse_mode: "Markdown" });
        }

        // Parar reenvio ao gerar PIX - retomará após 20 min se não pagar
        this.stopResendSchedule(botId, chatId);

        this.checkPaymentStatus(botId, payment.id, pixData.id, ctx);
      } catch (error) {
        console.error(`Erro ao processar pagamento:`, error);
        await ctx.answerCallbackQuery("Erro ao gerar PIX");
      }
    });

    try {
      // Validar token antes de iniciar
      try {
        await bot.api.getMe();
      } catch (tokenError: any) {
        const errorCode = tokenError?.error_code || tokenError?.error?.error_code;
        if (errorCode === 401) {
          console.warn(`⚠️  [Bot ${botId}] Token inválido ou expirado. Bot não será iniciado.`);
          return; // Não iniciar o bot se o token for inválido
        }
        throw tokenError; // Re-lançar outros erros
      }
      
      bot.start();
      this.bots.set(botId, bot);
      this.botConfigs.set(botId, config);
      console.log(`✅ [Bot ${botId}] Bot iniciado com sucesso`);
    } catch (error: any) {
      const errorCode = error?.error_code || error?.error?.error_code;
      const errorDesc = (error?.description || error?.error?.description || error?.message || "").toLowerCase();
      
      if (errorCode === 401 || errorDesc.includes("unauthorized")) {
        console.warn(`⚠️  [Bot ${botId}] Token inválido ou expirado. Bot não será iniciado.`);
      } else {
        console.error(`❌ [Bot ${botId}] Erro ao iniciar bot:`, error.message || error);
      }
    }
  }

  async stopResendSchedule(botId: string, chatId: string) {
    await removeResendJobs(botId, chatId);
    
    const botTimers = this.resendTimers.get(botId);
    if (botTimers) {
      const firstTimer = botTimers.get(`${chatId}_first`);
      if (firstTimer) {
        clearTimeout(firstTimer);
        botTimers.delete(`${chatId}_first`);
      }

      const recurringTimer = botTimers.get(chatId);
      if (recurringTimer) {
        clearInterval(recurringTimer);
        botTimers.delete(chatId);
      }

      if (botTimers.size === 0) {
        this.resendTimers.delete(botId);
      }
    }
  }

  /**
   * Envia mensagem de reenvio. Usado pelo BullMQ worker.
   */
  async sendResendMessage(botId: string, chatId: string) {
    try {
      let config = this.botConfigs.get(botId);
      
      if (!config) {
        const botData = await prisma.bot.findUnique({
          where: { id: botId },
          include: { 
            paymentButtons: true,
            resendImages: {
              orderBy: { order: "asc" },
            },
            resendCaptions: {
              orderBy: { order: "asc" },
            },
            resendButtonGroups: {
              orderBy: { order: "asc" },
            },
          },
        });

        if (!botData) {
          throw new Error(`Bot ${botId} não encontrado no banco de dados`);
        }

        if (!botData.isActive) {
          throw new Error(`Bot ${botId} está inativo`);
        }

        // Parse dos grupos de botões (JSON)
        const buttonGroups = (botData as any).resendButtonGroups?.map((group: any) => {
          try {
            return JSON.parse(group.buttons);
          } catch {
            return [];
          }
        }) || [];

        config = {
          syncpayApiKey: botData.syncpayApiKey,
          syncpayApiSecret: botData.syncpayApiSecret,
          startImage: botData.startImage,
          startCaption: botData.startCaption,
          resendImage: botData.resendImage,
          resendCaption: botData.resendCaption,
          resendImages: botData.resendImages?.map((img: any) => img.imageUrl) || [],
          resendCaptions: (botData as any).resendCaptions?.map((cap: any) => cap.captionText) || [],
          resendFirstDelay: botData.resendFirstDelay,
          resendInterval: botData.resendInterval,
          paymentButtons: botData.paymentButtons
            .filter((btn) => btn.type === "start")
            .map((btn) => ({
              text: btn.text,
              value: btn.value,
            })),
          resendPaymentButtons: botData.paymentButtons
            .filter((btn) => btn.type === "resend")
            .map((btn) => ({
              text: btn.text,
              value: btn.value,
            })),
          resendButtonGroups: buttonGroups,
          paymentConfirmedMessage: botData.paymentConfirmedMessage,
        };

        this.botConfigs.set(botId, config);
      }

      let bot = this.bots.get(botId);
      if (!bot) {
        const botData = await prisma.bot.findUnique({
          where: { id: botId },
          select: { telegramToken: true, isActive: true },
        });

        if (!botData || !botData.isActive) {
          throw new Error(`Bot ${botId} não encontrado ou está inativo`);
        }

        if (!config) {
          throw new Error(`Configuração do bot ${botId} não disponível`);
        }

        try {
          await this.startBot(botId, botData.telegramToken, config);
          bot = this.bots.get(botId);
          
          if (!bot) {
            // Verificar se o bot não foi iniciado devido a token inválido
            // Tentar validar o token para confirmar
            try {
              const testBot = new Bot(botData.telegramToken);
              await testBot.api.getMe();
              // Se chegou aqui, o token é válido mas houve outro problema
              throw new Error(`Falha ao inicializar bot ${botId}`);
            } catch (tokenError: any) {
              const errorCode = tokenError?.error_code || tokenError?.error?.error_code;
              if (errorCode === 401) {
                console.warn(`⚠️  [Bot ${botId}] Token inválido. Pulando reenvio.`);
                // Retornar erro específico para que a fila de reenvio possa tratar
                throw new Error(`Token inválido para bot ${botId}`);
              }
              throw new Error(`Falha ao inicializar bot ${botId}`);
            }
          }
        } catch (startError: any) {
          // Se o erro já indica token inválido, re-lançar
          if (startError.message?.includes("Token inválido")) {
            throw startError;
          }
          // Outros erros de inicialização
          throw new Error(`Falha ao inicializar bot ${botId}: ${startError.message || startError}`);
        }
      }

      // Buscar lead para obter os índices de rotação
      const lead = await prisma.lead.findFirst({
        where: {
          botId,
          telegramChatId: chatId,
        },
      });

      // Determinar qual grupo de botões usar (rotação)
      let buttonsToUse: Array<{ text: string; value: number }> | undefined = undefined;
      if (config.resendButtonGroups && config.resendButtonGroups.length > 0) {
        // Usar múltiplos grupos de botões com rotação
        const currentButtonIndex = lead?.resendButtonIndex || 0;
        buttonsToUse = config.resendButtonGroups[currentButtonIndex % config.resendButtonGroups.length];
        
        // Atualizar índice para próxima vez
        if (lead) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: {
              resendButtonIndex: (currentButtonIndex + 1) % config.resendButtonGroups.length,
            },
          });
        }
      } else if (config.resendPaymentButtons && config.resendPaymentButtons.length > 0) {
        // Fallback para botões de reenvio únicos (compatibilidade)
        buttonsToUse = config.resendPaymentButtons;
      } else {
        // Fallback para botões de início
        buttonsToUse = config.paymentButtons;
      }

      let keyboard: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } | undefined = undefined;
      if (buttonsToUse && buttonsToUse.length > 0) {
        keyboard = {
          inline_keyboard: buttonsToUse.map((btn) => [
            {
              text: this.formatButtonText(btn),
              callback_data: `payment_${btn.value}`,
            },
          ]),
        };
      }

      // Determinar qual imagem usar (rotação)
      let mediaUrl: string | null = null;
      if (config.resendImages && config.resendImages.length > 0) {
        // Usar múltiplas imagens com rotação
        const currentImageIndex = lead?.resendImageIndex || 0;
        mediaUrl = config.resendImages[currentImageIndex % config.resendImages.length];
        
        // Atualizar índice para próxima vez
        if (lead) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: {
              resendImageIndex: (currentImageIndex + 1) % config.resendImages.length,
            },
          });
        }
      } else {
        // Fallback para imagem única (compatibilidade)
        mediaUrl = config.resendImage || config.startImage;
      }

      // Determinar qual texto usar (rotação)
      let captionText: string;
      if (config.resendCaptions && config.resendCaptions.length > 0) {
        // Usar múltiplos textos com rotação
        const currentCaptionIndex = lead?.resendCaptionIndex || 0;
        captionText = config.resendCaptions[currentCaptionIndex % config.resendCaptions.length];
        
        // Atualizar índice para próxima vez
        if (lead) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: {
              resendCaptionIndex: (currentCaptionIndex + 1) % config.resendCaptions.length,
            },
          });
        }
      } else {
        // Fallback para texto único (compatibilidade)
        captionText = config.resendCaption || config.startCaption || "Bem-vindo!";
      }
      captionText = captionText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const hasButtonMessage = config.resendButtonMessage && config.resendButtonMessage.trim().length > 0;

      if (mediaUrl) {
        let mediaSent = false;
        try {
          const isVideo = this.isVideoUrl(mediaUrl);
          const media = await this.getMediaInput(mediaUrl);
          
          // Se há mensagem específica para botões, enviar mídia sem botões e depois mensagem separada
          const replyMarkup = hasButtonMessage ? undefined : keyboard;
          
          if (typeof media === 'string') {
            try {
              if (isVideo) {
                await bot.api.sendVideo(parseInt(chatId), media, {
                  caption: captionText,
                  reply_markup: replyMarkup,
                  parse_mode: undefined,
                });
              } else {
                await bot.api.sendPhoto(parseInt(chatId), media, {
                  caption: captionText,
                  reply_markup: replyMarkup,
                  parse_mode: undefined,
                });
              }
              mediaSent = true;
              
              // Se há mensagem específica para botões, enviar mensagem separada com os botões
              if (hasButtonMessage && keyboard) {
                const buttonMessage = config.resendButtonMessage!.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                await bot.api.sendMessage(parseInt(chatId), buttonMessage, {
                  reply_markup: keyboard,
                  parse_mode: undefined,
                });
              }
            } catch (urlError: any) {
              // Verificar se é erro de bloqueio
              const isBlockedError = this.isBlockedError(urlError);
              if (isBlockedError && lead) {
                await prisma.lead.update({
                  where: { id: lead.id },
                  data: { isBlocked: true },
                });
              }
              // Tentar enviar apenas texto se não for bloqueio
              if (!isBlockedError) {
                try {
                  await bot.api.sendMessage(parseInt(chatId), captionText, {
                    reply_markup: hasButtonMessage ? undefined : keyboard,
                    parse_mode: undefined,
                  });
                  mediaSent = true;
                  // Se há mensagem específica para botões, enviar mensagem separada
                  if (hasButtonMessage && keyboard) {
                    const buttonMessage = config.resendButtonMessage!.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                    await bot.api.sendMessage(parseInt(chatId), buttonMessage, {
                      reply_markup: keyboard,
                      parse_mode: undefined,
                    });
                  }
                } catch (messageError: any) {
                  const isBlockedError2 = this.isBlockedError(messageError);
                  if (isBlockedError2 && lead) {
                    await prisma.lead.update({
                      where: { id: lead.id },
                      data: { isBlocked: true },
                    });
                  }
                  throw messageError;
                }
              } else {
                throw urlError;
              }
            }
          } else {
            try {
              if (isVideo) {
                await bot.api.sendVideo(parseInt(chatId), media, {
                  caption: captionText,
                  reply_markup: replyMarkup,
                  parse_mode: undefined,
                });
              } else {
                await bot.api.sendPhoto(parseInt(chatId), media, {
                  caption: captionText,
                  reply_markup: replyMarkup,
                  parse_mode: undefined,
                });
              }
              mediaSent = true;
              
              // Se há mensagem específica para botões, enviar mensagem separada com os botões
              if (hasButtonMessage && keyboard) {
                const buttonMessage = config.resendButtonMessage!.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                await bot.api.sendMessage(parseInt(chatId), buttonMessage, {
                  reply_markup: keyboard,
                  parse_mode: undefined,
                });
              }
            } catch (fileError: any) {
              // Verificar se é erro de bloqueio
              const isBlockedError = this.isBlockedError(fileError);
              if (isBlockedError && lead) {
                await prisma.lead.update({
                  where: { id: lead.id },
                  data: { isBlocked: true },
                });
              }
              // Tentar enviar apenas texto se não for bloqueio
              if (!isBlockedError) {
                try {
                  await bot.api.sendMessage(parseInt(chatId), captionText, {
                    reply_markup: hasButtonMessage ? undefined : keyboard,
                    parse_mode: undefined,
                  });
                  mediaSent = true;
                  // Se há mensagem específica para botões, enviar mensagem separada
                  if (hasButtonMessage && keyboard) {
                    const buttonMessage = config.resendButtonMessage!.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                    await bot.api.sendMessage(parseInt(chatId), buttonMessage, {
                      reply_markup: keyboard,
                      parse_mode: undefined,
                    });
                  }
                } catch (messageError: any) {
                  const isBlockedError2 = this.isBlockedError(messageError);
                  if (isBlockedError2 && lead) {
                    await prisma.lead.update({
                      where: { id: lead.id },
                      data: { isBlocked: true },
                    });
                  }
                  throw messageError;
                }
              } else {
                throw fileError;
              }
            }
          }
        } catch (error: any) {
          if (!mediaSent) {
            try {
              await bot.api.sendMessage(parseInt(chatId), captionText, {
                reply_markup: hasButtonMessage ? undefined : keyboard,
                parse_mode: undefined,
              });
              mediaSent = true;
              // Se há mensagem específica para botões, enviar mensagem separada
              if (hasButtonMessage && keyboard) {
                const buttonMessage = config.resendButtonMessage!.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                await bot.api.sendMessage(parseInt(chatId), buttonMessage, {
                  reply_markup: keyboard,
                  parse_mode: undefined,
                });
              }
            } catch (textError: any) {
              // Verificar se é erro de bloqueio
              const isBlockedError = this.isBlockedError(textError);
              if (isBlockedError && lead) {
                await prisma.lead.update({
                  where: { id: lead.id },
                  data: { isBlocked: true },
                });
              }
              throw textError;
            }
          }
        }
        
        if (!mediaSent) {
          try {
            await bot.api.sendMessage(parseInt(chatId), captionText, {
              reply_markup: hasButtonMessage ? undefined : keyboard,
              parse_mode: undefined,
            });
            // Se há mensagem específica para botões, enviar mensagem separada
            if (hasButtonMessage && keyboard) {
              const buttonMessage = config.resendButtonMessage!.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
              await bot.api.sendMessage(parseInt(chatId), buttonMessage, {
                reply_markup: keyboard,
                parse_mode: undefined,
              });
            }
          } catch (messageError: any) {
            // Verificar se é erro de bloqueio
            const isBlockedError = this.isBlockedError(messageError);
            if (isBlockedError && lead) {
              await prisma.lead.update({
                where: { id: lead.id },
                data: { isBlocked: true },
              });
            }
            throw messageError;
          }
        }
      } else {
        try {
          await bot.api.sendMessage(parseInt(chatId), captionText, {
            reply_markup: hasButtonMessage ? undefined : keyboard,
            parse_mode: undefined,
          });
          // Se há mensagem específica para botões, enviar mensagem separada
          if (hasButtonMessage && keyboard) {
            const buttonMessage = config.resendButtonMessage!.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            await bot.api.sendMessage(parseInt(chatId), buttonMessage, {
              reply_markup: keyboard,
              parse_mode: undefined,
            });
          }
        } catch (messageError: any) {
          // Verificar se é erro de bloqueio
          const isBlockedError = this.isBlockedError(messageError);
          if (isBlockedError && lead) {
            await prisma.lead.update({
              where: { id: lead.id },
              data: { isBlocked: true },
            });
          }
          throw messageError;
        }
      }
    } catch (error: any) {
      const errorCode = error?.error_code || error?.error?.error_code;
      const errorDesc = (error?.description || error?.error?.description || error?.message || "").toLowerCase();
      
      // Verificar se é erro de token inválido (401)
      if (errorCode === 401 || errorDesc.includes("unauthorized")) {
        console.warn(`⚠️  [Bot ${botId}] Token inválido ao enviar mensagem de reenvio.`);
        throw error; // Re-lançar para que a fila de reenvio possa tratar
      }
      
      // Verificar se é erro de bloqueio no catch final - propagar para o worker tratar
      const isBlockedError = this.isBlockedError(error);
      if (isBlockedError) {
        await prisma.lead.updateMany({
          where: { botId, telegramChatId: chatId },
          data: { isBlocked: true },
        });
        throw error; // Worker trata silenciosamente
      }
      console.error(`[BotManager] Erro ao enviar mensagem de reenvio:`, error);
      throw error;
    }
  }

  async stopBot(botId: string) {
    const bot = this.bots.get(botId);
    if (bot) {
      try {
        await bot.stop();
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Erro ao parar bot:`, error);
      } finally {
        this.bots.delete(botId);
        this.botConfigs.delete(botId);
        
        const botTimers = this.resendTimers.get(botId);
        if (botTimers) {
          for (const timer of botTimers.values()) {
            if (typeof timer === 'number') {
              clearTimeout(timer);
            } else {
              clearInterval(timer);
            }
          }
          this.resendTimers.delete(botId);
        }
        
      }
    }
  }

  private async checkPaymentStatus(
    botId: string,
    paymentId: string,
    syncpayId: string,
    ctx: Context
  ) {
    const bot = await prisma.bot.findUnique({ where: { id: botId } });
    if (!bot) return;
    
    const syncpay = new SyncPayService(bot.syncpayApiKey, bot.syncpayApiSecret);

    const interval = setInterval(async () => {
      try {
        const payment = await prisma.payment.findUnique({
          where: { id: paymentId },
        });

        if (!payment || payment.status !== "pending") {
          clearInterval(interval);
          return;
        }

        // Verificar status no SyncPay
        const status = await syncpay.checkPayment(syncpayId);

        if (status === "paid") {
          await prisma.payment.update({
            where: { id: paymentId },
            data: {
              status: "paid",
              paidAt: new Date(),
            },
          });

          await ctx.reply("✅ Pagamento confirmado! Obrigado pela compra.");
          
          const chatId = ctx.chat?.id.toString();
          if (chatId) {
            this.stopResendSchedule(botId, chatId);
            
            try {
              const lead = await prisma.lead.findFirst({
                where: {
                  botId,
                  telegramChatId: chatId,
                },
              });

              if (lead) {
                await prisma.lead.update({
                  where: { id: lead.id },
                  data: {
                    isNew: false,
                    convertedAt: new Date(),
                  },
                });
              }
            } catch (leadError) {
              // Ignorar erro ao atualizar lead
            }
          }
          
          clearInterval(interval);
        } else if (status === "expired" || status === "cancelled") {
          await prisma.payment.update({
            where: { id: paymentId },
            data: { status },
          });
          clearInterval(interval);
        }
      } catch (error) {
        console.error(`Erro ao verificar pagamento:`, error);
      }
    }, 10000);

    setTimeout(() => clearInterval(interval), 30 * 60 * 1000);
  }

  async restartAllBots() {
    const activeBots = await prisma.bot.findMany({
      where: { 
        isActive: true,
      },
      include: { 
        paymentButtons: true,
        resendImages: {
          orderBy: { order: "asc" },
        },
        resendCaptions: {
          orderBy: { order: "asc" },
        },
        resendButtonGroups: {
          orderBy: { order: "asc" },
        },
      },
    });

    for (const bot of activeBots) {
      await this.stopBot(bot.id);
    }
    
    await new Promise(resolve => setTimeout(resolve, 10000));

    for (let i = 0; i < activeBots.length; i++) {
      const bot = activeBots[i];
      try {
        // Parse dos grupos de botões (JSON)
        const buttonGroups = (bot as any).resendButtonGroups?.map((group: any) => {
          try {
            return JSON.parse(group.buttons);
          } catch {
            return [];
          }
        }) || [];

        await this.startBot(bot.id, bot.telegramToken, {
        syncpayApiKey: bot.syncpayApiKey,
        syncpayApiSecret: bot.syncpayApiSecret,
        startImage: bot.startImage,
        startCaption: bot.startCaption,
        startButtonMessage: bot.startButtonMessage,
        resendImage: bot.resendImage,
        resendCaption: bot.resendCaption,
        resendButtonMessage: bot.resendButtonMessage,
        resendImages: bot.resendImages?.map((img: any) => img.imageUrl) || [],
        resendCaptions: (bot as any).resendCaptions?.map((cap: any) => cap.captionText) || [],
        resendFirstDelay: bot.resendFirstDelay,
        resendInterval: bot.resendInterval,
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
        resendButtonGroups: buttonGroups,
        paymentConfirmedMessage: bot.paymentConfirmedMessage,
        });
      } catch (error: any) {
        const errorCode = error?.error_code || error?.error?.error_code;
        const errorDesc = (error?.description || error?.error?.description || error?.message || "").toLowerCase();
        
        if (errorCode === 401 || errorDesc.includes("unauthorized")) {
          console.warn(`⚠️  [Bot ${bot.id}] Token inválido ou expirado. Verifique o token do bot "${bot.name}"`);
        } else {
          console.error(`❌ [Bot ${bot.id}] Erro ao iniciar bot "${bot.name}":`, error.message || error);
        }
      }
      
      if (i < activeBots.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
}
