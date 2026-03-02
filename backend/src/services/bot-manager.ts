import { Bot, Context, InputFile } from "grammy";
import { PrismaClient } from "@prisma/client";
import { SyncPayService } from "./syncpay";
import { TrackingStorage } from "./tracking-storage";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { scheduleResends, removeResendJobs } from "./resend-queue";

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
  // Armazenar configurações dos bots para acesso posterior
  private botConfigs: Map<string, BotConfig> = new Map();
  // Usar caminho absoluto para garantir que funciona no Docker
  private UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), "uploads");
  // Armazenar timers de reenvio por botId e chatId (mantido para compatibilidade, mas será substituído por BullMQ)
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
    // Verificar se é uma URL que aponta para nosso servidor (localhost, 127.0.0.1, ou nosso domínio)
    const apiUrl = process.env.API_URL || process.env.BETTER_AUTH_URL || "";
    let isLocalUrl = mediaUrl.includes("localhost") || 
                     mediaUrl.includes("127.0.0.1") || 
                     (mediaUrl.startsWith("/uploads/") && !mediaUrl.startsWith("http"));
    
    // Verificar se a URL contém o hostname do nosso servidor
    if (apiUrl && !isLocalUrl) {
      try {
        const apiHostname = new URL(apiUrl).hostname;
        isLocalUrl = mediaUrl.includes(apiHostname);
      } catch (e) {
        console.warn(`[BotManager] Erro ao parsear API_URL:`, e);
      }
    }
    
    // Se for URL do nosso servidor, tentar ler do sistema de arquivos
    if (isLocalUrl) {
      // Extrair nome do arquivo da URL
      let fileName: string | null = null;
      
      if (mediaUrl.includes("/uploads/")) {
        fileName = mediaUrl.split("/uploads/")[1]?.split("?")[0]; // Remove query params se houver
      } else if (mediaUrl.startsWith("/uploads/")) {
        fileName = mediaUrl.replace("/uploads/", "").split("?")[0];
      }
      
      if (fileName) {
        const filePath = join(this.UPLOAD_DIR, fileName);
        
        // Tentar caminhos alternativos se o arquivo não for encontrado
        if (!existsSync(filePath)) {
          // Tentar caminho relativo
          const relativePath = join(process.cwd(), "uploads", fileName);
          if (existsSync(relativePath)) {
            try {
              const fileBuffer = await readFile(relativePath);
              return new InputFile(fileBuffer, fileName);
            } catch (error) {
              console.error(`[BotManager] Erro ao ler arquivo ${relativePath}:`, error);
            }
          }
          
          // Tentar caminho absoluto do Docker
          const dockerPath = join("/app/backend/uploads", fileName);
          if (existsSync(dockerPath)) {
            try {
              const fileBuffer = await readFile(dockerPath);
              return new InputFile(fileBuffer, fileName);
            } catch (error) {
              console.error(`[BotManager] Erro ao ler arquivo ${dockerPath}:`, error);
            }
          }
        } else {
          try {
            const fileBuffer = await readFile(filePath);
            return new InputFile(fileBuffer, fileName);
          } catch (error) {
            console.error(`[BotManager] Erro ao ler arquivo ${filePath}:`, error);
          }
        }
        
        console.warn(`[BotManager] Arquivo não encontrado em nenhum caminho: ${fileName}`);
      }
    }
    
    // Fallback: tentar baixar a URL se for do nosso servidor
    if (isLocalUrl && apiUrl) {
      try {
        // Extrair nome do arquivo antes do fetch
        const fileName = mediaUrl.split("/").pop()?.split("?")[0] || "image.jpg";
        
        // Usar URL interna do container para evitar problemas de rede
        const internalUrl = mediaUrl.replace(new URL(apiUrl).origin, `http://localhost:${process.env.PORT || 3000}`);
        const response = await fetch(internalUrl);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          return new InputFile(Buffer.from(arrayBuffer), fileName);
        } else {
          console.error(`[BotManager] ERRO: Falha ao baixar arquivo: ${response.status} ${response.statusText}`);
          // Se não conseguir baixar, tentar ler do sistema de arquivos novamente com caminho absoluto
          const absolutePath = join(this.UPLOAD_DIR, fileName);
          if (existsSync(absolutePath)) {
            try {
              const fileBuffer = await readFile(absolutePath);
              return new InputFile(fileBuffer, fileName);
            } catch (error) {
              console.error(`[BotManager] Erro ao ler arquivo ${absolutePath}:`, error);
            }
          }
          throw new Error(`Arquivo não encontrado: ${mediaUrl}`);
        }
      } catch (error) {
        console.error(`[BotManager] Erro ao baixar arquivo de ${mediaUrl}:`, error);
        // Se for URL local e falhar, não retornar URL (vai dar erro no Telegram)
        throw new Error(`Não foi possível acessar o arquivo: ${mediaUrl}`);
      }
    }
    
    // Se não for URL local, retornar URL diretamente (Telegram tentará baixar)
    return mediaUrl;
  }

  async startBot(botId: string, token: string, config: BotConfig) {
    // Parar bot existente se houver
    await this.stopBot(botId);
    
    // Aguardar mais tempo para garantir que o bot anterior foi completamente parado
    // e que não há conflitos com outras instâncias
    await new Promise(resolve => setTimeout(resolve, 5000));

    const bot = new Bot(token);
    const syncpay = new SyncPayService(config.syncpayApiKey, config.syncpayApiSecret);
    
    // Adicionar handler de erro global para capturar erros 409 durante o long polling
    bot.catch(async (error) => {
      const errorCode = (error as any).error_code || (error as any).error?.error_code;
      const errorDesc = (error as any).description || (error as any).error?.description || (error as any).message || '';
      
      if (errorCode === 409 || errorDesc.includes('409') || errorDesc.includes('Conflict')) {
        console.warn(`[Bot ${botId}] Erro 409 detectado durante long polling. Aguardando 10 segundos antes de parar...`);
        // Aguardar antes de parar para dar tempo de outras instâncias terminarem
        await new Promise(resolve => setTimeout(resolve, 10000));
        console.warn(`[Bot ${botId}] Parando bot após erro 409...`);
        await this.stopBot(botId).catch(err => {
          console.error(`[Bot ${botId}] Erro ao parar bot após 409:`, err);
        });
      } else {
        console.error(`[Bot ${botId}] Erro não tratado:`, error);
      }
    });

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
      } else {
        console.warn(`[Bot ${botId}] Nenhum botão de pagamento configurado para /start`);
      }

      const caption = (config.startCaption || "Bem-vindo!").replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      
      if (config.startImage) {
        try {
          const isVideo = this.isVideoUrl(config.startImage);
          const media = await this.getMediaInput(config.startImage);
          
          // Verificar se o media é uma string (URL) e se é URL local que falhou
          if (typeof media === 'string' && (media.includes('bot-backend.clashdata.pro') || media.includes('localhost'))) {
            console.warn(`[Bot ${botId}] Arquivo não encontrado, enviando apenas texto`);
            await bot.api.sendMessage(parseInt(chatId), caption, {
              reply_markup: keyboard,
              parse_mode: undefined,
            });
          } else {
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
          }
        } catch (error) {
          console.error(`[Bot ${botId}] Erro ao enviar mídia, enviando apenas texto:`, error);
          await bot.api.sendMessage(parseInt(chatId), caption, {
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
      } else {
        console.warn(`[Bot ${botId}] Nenhum botão de pagamento configurado para reenvio`);
      }

      // Usar mídia e caption de reenvio se configurado, senão usar os de start
      const mediaUrl = config.resendImage || config.startImage;
      const captionText = (config.resendCaption || config.startCaption || "Bem-vindo!").replace(/\r\n/g, '\n').replace(/\r/g, '\n');

      if (mediaUrl) {
        try {
          const isVideo = this.isVideoUrl(mediaUrl);
          const media = await this.getMediaInput(mediaUrl);
          
          // Verificar se o media é uma string (URL) e se é URL local que falhou
          if (typeof media === 'string' && (media.includes('bot-backend.clashdata.pro') || media.includes('localhost'))) {
            console.warn(`[Bot ${botId}] Arquivo não encontrado no reenvio, enviando apenas texto`);
            await bot.api.sendMessage(parseInt(chatId), captionText, {
              reply_markup: keyboard,
              parse_mode: undefined,
            });
          } else {
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
          }
        } catch (error) {
          console.error(`[Bot ${botId}] Erro ao enviar mídia no reenvio, enviando apenas texto:`, error);
          await bot.api.sendMessage(parseInt(chatId), captionText, {
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

    // Função para iniciar reenvios automáticos usando BullMQ
    const startResendSchedule = async (chatId: string) => {
      
      // Limpar jobs existentes para este chat
      await this.stopResendSchedule(botId, chatId);

      // Verificar se o lead está pausado
      const lead = await prisma.lead.findFirst({
        where: {
          botId,
          telegramChatId: chatId,
        },
      });

      if ((lead as any)?.resendPaused) {
        return;
      }

      // Agendar reenvios usando BullMQ
      await scheduleResends(
        botId,
        chatId,
        config.resendFirstDelay || 20,
        config.resendInterval || 10
      );
    };

    // Função para extrair parâmetros de rastreamento do comando /start
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

      // Primeiro, tentar recuperar do TrackingStorage (token gerado pelo link intermediário)
      const trackingStorage = TrackingStorage.getInstance();
      const storedParams = trackingStorage.retrieve(startParam);
      
      if (storedParams) {
        return storedParams;
      }

      // Se não encontrou no storage, tentar parsear como query string (comportamento antigo)
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
        const trackingParams = await extractTrackingParams(startParam);
        
        // Verificar se há parâmetros de tracking (vindo de anúncio)
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
            // Atualizar lead existente
            const updateData: any = {
              telegramUsername: user?.username || undefined,
              firstName: user?.first_name || undefined,
              lastName: user?.last_name || undefined,
              isNew: true, // Marcar como novo novamente
            };

            // Se veio de um anúncio (tem parâmetros de tracking), atualizar sempre
            // Se veio direto do bot (sem parâmetros), preservar os dados antigos
            if (hasTrackingParams) {
              // Atualizar todos os parâmetros de tracking (mesmo que já existam)
              // Isso permite atualizar quando o usuário vem de um anúncio novo
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
            } else {
              // Sem parâmetros de tracking - preservar dados antigos
            }

            await prisma.lead.update({
              where: { id: existingLead.id },
              data: updateData,
            });
          } else {
            // Criar novo lead com dados de rastreamento (se houver)
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
    // Nota: bot.start() inicia o long polling de forma assíncrona
    // Erros podem ocorrer durante o long polling, não imediatamente
    try {
      bot.start();
      this.bots.set(botId, bot);
    } catch (error: any) {
      console.error(`[Bot ${botId}] Erro ao iniciar bot:`, error);
      // Não lançar o erro para não quebrar o fluxo, mas logar
    }
  }

  // Parar reenvios para um chat específico
  async stopResendSchedule(botId: string, chatId: string) {
    
    // Remover jobs do BullMQ
    await removeResendJobs(botId, chatId);
    
    // Limpar timers antigos (compatibilidade)
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

  // Método público para enviar mensagem de reenvio (usado pelo BullMQ worker)
  async sendResendMessage(botId: string, chatId: string) {
    try {
      const config = this.botConfigs.get(botId);
      if (!config) {
        throw new Error(`Configuração do bot ${botId} não encontrada`);
      }

      const bot = this.bots.get(botId);
      if (!bot) {
        throw new Error(`Bot ${botId} não encontrado`);
      }

      // Criar keyboard com botões de pagamento
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
      }

      // Usar mídia e caption de reenvio se configurado, senão usar os de start
      const mediaUrl = config.resendImage || config.startImage;
      const captionText = (config.resendCaption || config.startCaption || "Bem-vindo!").replace(/\r\n/g, '\n').replace(/\r/g, '\n');

      if (mediaUrl) {
        let mediaSent = false;
        try {
          const isVideo = this.isVideoUrl(mediaUrl);
          const media = await this.getMediaInput(mediaUrl);
          
          // Se getMediaInput retornou uma string (URL), significa que o arquivo não foi encontrado localmente
          // Tentar enviar como URL primeiro, se falhar, enviar apenas texto
          if (typeof media === 'string') {
            // Se é uma URL que falhou ao baixar, enviar apenas texto
            if (media.includes('bot-backend.clashdata.pro') || media.includes('localhost') || media.startsWith('http')) {
              console.warn(`[BotManager] Arquivo não encontrado no reenvio (${mediaUrl}), enviando apenas texto`);
              await bot.api.sendMessage(parseInt(chatId), captionText, {
                reply_markup: keyboard,
                parse_mode: undefined,
              });
              mediaSent = true;
            } else {
              // Tentar enviar como URL externa
              try {
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
                mediaSent = true;
              } catch (urlError) {
                console.warn(`[BotManager] Erro ao enviar mídia via URL, enviando apenas texto:`, urlError);
                await bot.api.sendMessage(parseInt(chatId), captionText, {
                  reply_markup: keyboard,
                  parse_mode: undefined,
                });
                mediaSent = true;
              }
            }
          } else {
            // Media é um InputFile, tentar enviar
            try {
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
              mediaSent = true;
            } catch (fileError) {
              console.warn(`[BotManager] Erro ao enviar arquivo de mídia, enviando apenas texto:`, fileError);
              await bot.api.sendMessage(parseInt(chatId), captionText, {
                reply_markup: keyboard,
                parse_mode: undefined,
              });
              mediaSent = true;
            }
          }
        } catch (error: any) {
          // Se ainda não enviou, tentar enviar apenas texto
          if (!mediaSent) {
            console.error(`[BotManager] Erro ao processar mídia no reenvio (${mediaUrl}), enviando apenas texto:`, error?.message || error);
            try {
              await bot.api.sendMessage(parseInt(chatId), captionText, {
                reply_markup: keyboard,
                parse_mode: undefined,
              });
              mediaSent = true;
            } catch (textError) {
              console.error(`[BotManager] Erro crítico ao enviar mensagem de texto no reenvio:`, textError);
              throw textError;
            }
          }
        }
        
        // Garantir que a mensagem foi enviada
        if (!mediaSent) {
          console.warn(`[BotManager] Mídia não foi enviada, enviando apenas texto como fallback`);
          await bot.api.sendMessage(parseInt(chatId), captionText, {
            reply_markup: keyboard,
            parse_mode: undefined,
          });
        }
      } else {
        // Sem mídia, enviar apenas texto
        await bot.api.sendMessage(parseInt(chatId), captionText, {
          reply_markup: keyboard,
          parse_mode: undefined,
        });
      }
      
      console.log(`[BotManager] Mensagem de reenvio enviada com sucesso para bot ${botId}, chat ${chatId}`);
    } catch (error: any) {
      console.error(`[BotManager] Erro crítico ao enviar mensagem de reenvio para bot ${botId}, chat ${chatId}:`, error);
      throw error;
    }
  }

  async stopBot(botId: string) {
    const bot = this.bots.get(botId);
    if (bot) {
      try {
        // Parar o bot e aguardar um pouco para garantir que parou completamente
        await bot.stop();
        // Aguardar um pouco mais para garantir que o long polling foi encerrado
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Erro ao parar bot ${botId}:`, error);
      } finally {
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


    // Parar todos os bots primeiro
    for (const bot of activeBots) {
      await this.stopBot(bot.id);
    }
    
    // Aguardar mais tempo antes de reiniciar todos para garantir que todos foram parados
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Iniciar bots com delay entre cada um para evitar conflitos
    for (let i = 0; i < activeBots.length; i++) {
      const bot = activeBots[i];
      try {
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
      } catch (error: any) {
        console.error(`Erro ao iniciar bot ${bot.id}:`, error);
        // Continuar com os próximos bots mesmo se um falhar
      }
      
      // Aguardar um pouco entre cada bot para evitar conflitos
      if (i < activeBots.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
}
