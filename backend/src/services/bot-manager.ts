import { Bot, Context, InputFile } from "grammy";
import { PrismaClient } from "@prisma/client";
import { SyncPayService } from "./syncpay";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const prisma = new PrismaClient();

interface BotConfig {
  syncpayApiKey: string;
  syncpayApiSecret: string;
  startImage?: string | null;
  startCaption?: string | null;
  resendImage?: string | null;
  resendCaption?: string | null;
  resendFirstDelay?: number;
  resendInterval?: number;
  paymentButtons: Array<{ text: string; value: number }>;
  resendPaymentButtons?: Array<{ text: string; value: number }>;
  paymentConfirmedMessage?: string | null;
}

export class BotManager {
  private static instance: BotManager;
  private bots: Map<string, Bot> = new Map();
  private UPLOAD_DIR = join(process.cwd(), "uploads");
  // Armazenar timers de reenvio por botId e chatId
  private resendTimers: Map<string, Map<string, NodeJS.Timeout>> = new Map();

  private constructor() {}

  static getInstance(): BotManager {
    if (!BotManager.instance) {
      BotManager.instance = new BotManager();
    }
    return BotManager.instance;
  }

  // Helper para detectar se é vídeo pela extensão
  private isVideoUrl(url: string): boolean {
    return /\.(mp4|webm|ogg|mov)$/i.test(url);
  }

  // Helper para converter URL local em InputFile
  private async getMediaInput(mediaUrl: string): Promise<string | InputFile> {
    // Se não for URL local (localhost ou 127.0.0.1), retornar URL diretamente
    // Verificar também se é uma URL relativa que precisa ser convertida
    const isLocalUrl = mediaUrl.includes("localhost") || 
                       mediaUrl.includes("127.0.0.1") || 
                       (mediaUrl.startsWith("/uploads/") && !mediaUrl.startsWith("http"));
    
    if (!isLocalUrl) {
      return mediaUrl;
    }

    // Extrair nome do arquivo da URL
    const fileName = mediaUrl.split("/uploads/")[1];
    if (!fileName) {
      return mediaUrl; // Fallback para URL se não conseguir extrair
    }

    const filePath = join(this.UPLOAD_DIR, fileName);
    if (!existsSync(filePath)) {
      console.warn(`Arquivo não encontrado: ${filePath}`);
      return mediaUrl; // Fallback para URL
    }

    try {
      const fileBuffer = await readFile(filePath);
      return new InputFile(fileBuffer, fileName);
    } catch (error) {
      console.error(`Erro ao ler arquivo ${filePath}:`, error);
      return mediaUrl; // Fallback para URL
    }
  }

  async startBot(botId: string, token: string, config: BotConfig) {
    // Parar bot existente se houver
    await this.stopBot(botId);

    const bot = new Bot(token);
    const syncpay = new SyncPayService(config.syncpayApiKey, config.syncpayApiSecret);

    // Função para enviar mensagem de start (reutilizável)
    const sendStartMessage = async (chatId: string) => {
      // Criar keyboard com botões de pagamento
      let keyboard: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } | undefined = undefined;
      if (config.paymentButtons && config.paymentButtons.length > 0) {
        keyboard = {
          inline_keyboard: config.paymentButtons.map((btn) => [
            {
              text: `${btn.text} - R$ ${(btn.value / 100).toFixed(2)}`,
              callback_data: `payment_${btn.value}`,
            },
          ]),
        };
        console.log(`[Bot ${botId}] Enviando mensagem /start com ${config.paymentButtons.length} botões de pagamento`);
      } else {
        console.warn(`[Bot ${botId}] Nenhum botão de pagamento configurado para /start`);
      }

      const caption = (config.startCaption || "Bem-vindo!").replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      
      if (config.startImage) {
        const isVideo = this.isVideoUrl(config.startImage);
        const media = await this.getMediaInput(config.startImage);
        
        if (isVideo) {
          await bot.api.sendVideo(parseInt(chatId), media, {
            caption: caption,
            reply_markup: keyboard,
            parse_mode: undefined,
          });
        } else {
          await bot.api.sendPhoto(parseInt(chatId), media, {
            caption: caption,
            reply_markup: keyboard,
            parse_mode: undefined,
          });
        }
      } else {
        const message = caption;
        await bot.api.sendMessage(parseInt(chatId), message, {
          reply_markup: keyboard,
          parse_mode: undefined,
        });
      }
    };

    // Função para enviar mensagem de reenvio (usa resendImage/resendCaption ou fallback para start)
    const sendResendMessage = async (chatId: string) => {
      // Criar keyboard com botões de pagamento (usa resendPaymentButtons se disponível, senão usa paymentButtons)
      let keyboard: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } | undefined = undefined;
      const buttonsToUse = config.resendPaymentButtons && config.resendPaymentButtons.length > 0 
        ? config.resendPaymentButtons 
        : config.paymentButtons;
      
      if (buttonsToUse && buttonsToUse.length > 0) {
        keyboard = {
          inline_keyboard: buttonsToUse.map((btn) => [
            {
              text: `${btn.text} - R$ ${(btn.value / 100).toFixed(2)}`,
              callback_data: `payment_${btn.value}`,
            },
          ]),
        };
        console.log(`[Bot ${botId}] Enviando mensagem de reenvio com ${buttonsToUse.length} botões de pagamento`);
      } else {
        console.warn(`[Bot ${botId}] Nenhum botão de pagamento configurado para reenvio`);
      }

      // Usar mídia e caption de reenvio se configurado, senão usar os de start
      const mediaUrl = config.resendImage || config.startImage;
      const captionText = (config.resendCaption || config.startCaption || "Bem-vindo!").replace(/\r\n/g, '\n').replace(/\r/g, '\n');

      if (mediaUrl) {
        const isVideo = this.isVideoUrl(mediaUrl);
        const media = await this.getMediaInput(mediaUrl);
        
        if (isVideo) {
          await bot.api.sendVideo(parseInt(chatId), media, {
            caption: captionText,
            reply_markup: keyboard,
            parse_mode: undefined,
          });
        } else {
          await bot.api.sendPhoto(parseInt(chatId), media, {
            caption: captionText,
            reply_markup: keyboard,
            parse_mode: undefined,
          });
        }
      } else {
        await bot.api.sendMessage(parseInt(chatId), captionText, {
          reply_markup: keyboard,
          parse_mode: undefined,
        });
      }
    };

    // Função para verificar se o usuário já comprou
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

    // Função para iniciar reenvios automáticos
    const startResendSchedule = async (chatId: string) => {
      // Limpar timers existentes para este chat
      this.stopResendSchedule(botId, chatId);

      const firstDelay = (config.resendFirstDelay || 20) * 60 * 1000; // Converter minutos para ms
      const interval = (config.resendInterval || 10) * 60 * 1000; // Converter minutos para ms

      // Primeira mensagem após o delay configurado
      const firstTimer = setTimeout(async () => {
        try {
          // Verificar se o usuário já comprou
          const hasPurchased = await hasUserPurchased(chatId);
          if (hasPurchased) {
            this.stopResendSchedule(botId, chatId);
            return;
          }

          // Enviar mensagem de reenvio
          await sendResendMessage(chatId);

          // Iniciar reenvios no intervalo configurado
          const recurringTimer = setInterval(async () => {
            try {
              // Verificar se o usuário já comprou
              const hasPurchased = await hasUserPurchased(chatId);
              if (hasPurchased) {
                this.stopResendSchedule(botId, chatId);
                return;
              }

              // Verificar se o bot ainda existe
              const bot = this.bots.get(botId);
              if (!bot) {
                clearInterval(recurringTimer);
                return;
              }

              // Enviar mensagem de reenvio
              await sendResendMessage(chatId);
            } catch (error) {
              console.error(`Erro ao reenviar mensagem para chat ${chatId}:`, error);
            }
          }, interval);

          // Armazenar timer de reenvio recorrente
          if (!this.resendTimers.has(botId)) {
            this.resendTimers.set(botId, new Map());
          }
          this.resendTimers.get(botId)!.set(chatId, recurringTimer);
        } catch (error) {
          console.error(`Erro no primeiro reenvio para chat ${chatId}:`, error);
        }
      }, firstDelay);

      // Armazenar timer da primeira mensagem
      if (!this.resendTimers.has(botId)) {
        this.resendTimers.set(botId, new Map());
      }
      this.resendTimers.get(botId)!.set(`${chatId}_first`, firstTimer);
    };

    // Função para extrair parâmetros de rastreamento do comando /start
    const extractTrackingParams = (startParam?: string) => {
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

      // Tentar parsear como query string (ex: utm_source=facebook&utm_campaign=ads)
      if (startParam.includes('=')) {
        // Parsear manualmente a query string
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
        // Se não for query string, tratar como referência simples
        params.ref = startParam;
      }

      return params;
    };

    // Comando /start - envia mensagem inicial e inicia o agendamento de reenvios
    bot.command("start", async (ctx: Context) => {
      try {
        const chatId = ctx.chat?.id.toString();
        if (!chatId) {
          await ctx.reply("Erro: Chat não encontrado.");
          return;
        }

        // Extrair parâmetros de rastreamento do comando /start
        const startParam = ctx.message?.text?.split(' ')[1]; // Parâmetro após /start
        const trackingParams = extractTrackingParams(startParam);

        // Criar ou atualizar lead
        try {
          const user = ctx.from;
          const existingLead = await prisma.lead.findFirst({
            where: {
              botId,
              telegramChatId: chatId,
            },
          });

          if (existingLead) {
            // Atualizar lead existente (só atualiza tracking se não existir)
            const updateData: any = {
              telegramUsername: user?.username || undefined,
              firstName: user?.first_name || undefined,
              lastName: user?.last_name || undefined,
              isNew: true, // Marcar como novo novamente
            };

            // Só atualiza tracking params se não existirem (preserva dados originais)
            if (!existingLead.utmSource && trackingParams.utmSource) {
              updateData.utmSource = trackingParams.utmSource;
            }
            if (!existingLead.utmMedium && trackingParams.utmMedium) {
              updateData.utmMedium = trackingParams.utmMedium;
            }
            if (!existingLead.utmCampaign && trackingParams.utmCampaign) {
              updateData.utmCampaign = trackingParams.utmCampaign;
            }
            if (!existingLead.utmContent && trackingParams.utmContent) {
              updateData.utmContent = trackingParams.utmContent;
            }
            if (!existingLead.utmTerm && trackingParams.utmTerm) {
              updateData.utmTerm = trackingParams.utmTerm;
            }
            if (!existingLead.fbclid && trackingParams.fbclid) {
              updateData.fbclid = trackingParams.fbclid;
            }
            if (!existingLead.gclid && trackingParams.gclid) {
              updateData.gclid = trackingParams.gclid;
            }
            if (!existingLead.ref && trackingParams.ref) {
              updateData.ref = trackingParams.ref;
            }

            await prisma.lead.update({
              where: { id: existingLead.id },
              data: updateData,
            });
          } else {
            // Criar novo lead com dados de rastreamento
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
          console.error(`Erro ao criar/atualizar lead:`, leadError);
          // Não interromper o fluxo se houver erro ao criar lead
        }

        // Verificar se o usuário já comprou neste bot específico
        const hasPurchased = await hasUserPurchased(chatId);
        
        // Enviar mensagem inicial sempre (mesmo se já comprou)
        await sendStartMessage(chatId);

        // Só inicia reenvios se o usuário não comprou neste bot
        if (!hasPurchased) {
          // Reiniciar agendamento de reenvios (limpa timers antigos e cria novos)
          await startResendSchedule(chatId);
        }
      } catch (error) {
        console.error(`Erro no comando /start do bot ${botId}:`, error);
        try {
          await ctx.reply("❌ Erro ao processar comando. Tente novamente.");
        } catch (replyError) {
          console.error(`Erro ao enviar mensagem de erro:`, replyError);
        }
      }
    });

    // Callback de pagamento
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

        // Criar pagamento no banco
        const payment = await prisma.payment.create({
          data: {
            botId,
            telegramChatId: chatId,
            amount,
            status: "pending",
          },
        });

        // Construir URL do webhook
        // Prioridade: WEBHOOK_URL > BETTER_AUTH_URL > API_URL
        const webhookUrl = process.env.WEBHOOK_URL 
          ? `${process.env.WEBHOOK_URL}/api/webhooks/syncpay`
          : process.env.BETTER_AUTH_URL
          ? `${process.env.BETTER_AUTH_URL}/api/webhooks/syncpay`
          : process.env.API_URL
          ? `${process.env.API_URL}/api/webhooks/syncpay`
          : undefined;

        // Criar PIX no SyncPay com webhook e external_reference (ID do pagamento)
        const pixData = await syncpay.createPix(amount, {
          description: `Pagamento via Telegram Bot - ${botId}`,
          webhookUrl: webhookUrl,
          externalReference: payment.id, // Passar ID do pagamento para facilitar busca no webhook
        });

        if (!pixData) {
          await ctx.reply("Erro ao gerar PIX. Tente novamente.");
          return;
        }

        // Atualizar pagamento com dados do PIX
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            syncpayId: pixData.id,
            pixCode: pixData.pixCode,
            qrCode: pixData.qrCode,
            expiresAt: pixData.expiresAt,
          },
        });

        // Enviar PIX para o usuário
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

        // Verificar pagamento periodicamente
        this.checkPaymentStatus(botId, payment.id, pixData.id, ctx);
      } catch (error) {
        console.error(`Erro ao processar pagamento do bot ${botId}:`, error);
        await ctx.answerCallbackQuery("Erro ao gerar PIX");
      }
    });

    // Iniciar bot
    bot.start();
    this.bots.set(botId, bot);

    console.log(`Bot ${botId} iniciado com sucesso`);
  }

  // Parar reenvios para um chat específico
  stopResendSchedule(botId: string, chatId: string) {
    const botTimers = this.resendTimers.get(botId);
    if (!botTimers) return;

    // Limpar timer da primeira mensagem
    const firstTimer = botTimers.get(`${chatId}_first`);
    if (firstTimer) {
      clearTimeout(firstTimer);
      botTimers.delete(`${chatId}_first`);
    }

    // Limpar timer de reenvios recorrentes
    const recurringTimer = botTimers.get(chatId);
    if (recurringTimer) {
      clearInterval(recurringTimer);
      botTimers.delete(chatId);
    }

    // Se não houver mais timers para este bot, remover o Map
    if (botTimers.size === 0) {
      this.resendTimers.delete(botId);
    }
  }

  async stopBot(botId: string) {
    const bot = this.bots.get(botId);
    if (bot) {
      await bot.stop();
      this.bots.delete(botId);
      
      // Limpar todos os timers de reenvio deste bot
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
      
      console.log(`Bot ${botId} parado`);
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
          
          // Parar reenvios automáticos quando o pagamento for confirmado
          const chatId = ctx.chat?.id.toString();
          if (chatId) {
            this.stopResendSchedule(botId, chatId);
            
            // Marcar lead como convertido
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
              console.error(`Erro ao atualizar lead convertido:`, leadError);
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
        console.error(`Erro ao verificar pagamento ${paymentId}:`, error);
      }
    }, 10000); // Verificar a cada 10 segundos

    // Parar verificação após 30 minutos
    setTimeout(() => clearInterval(interval), 30 * 60 * 1000);
  }

  async restartAllBots() {
    const activeBots = await prisma.bot.findMany({
      where: { isActive: true },
      include: { paymentButtons: true },
    });

    for (const bot of activeBots) {
      await this.startBot(bot.id, bot.telegramToken, {
        syncpayApiKey: bot.syncpayApiKey,
        syncpayApiSecret: bot.syncpayApiSecret,
        startImage: bot.startImage,
        startCaption: bot.startCaption,
        resendImage: bot.resendImage,
        resendCaption: bot.resendCaption,
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
        paymentConfirmedMessage: bot.paymentConfirmedMessage,
      });
    }
  }
}
