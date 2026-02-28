import { Bot, Context, InputFile } from "grammy";
import { PrismaClient } from "@prisma/client";
import { SyncPayService } from "./syncpay";
import { TrackingStorage } from "./tracking-storage";
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
  // Usar caminho absoluto para garantir que funciona no Docker
  private UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), "uploads");
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
    console.log(`[BotManager] getMediaInput chamado com URL: ${mediaUrl}`);
    
    // Verificar se é uma URL que aponta para nosso servidor (localhost, 127.0.0.1, ou nosso domínio)
    const apiUrl = process.env.API_URL || process.env.BETTER_AUTH_URL || "";
    let isLocalUrl = mediaUrl.includes("localhost") || 
                     mediaUrl.includes("127.0.0.1") || 
                     (mediaUrl.startsWith("/uploads/") && !mediaUrl.startsWith("http"));
    
    console.log(`[BotManager] API_URL: ${apiUrl}`);
    console.log(`[BotManager] isLocalUrl inicial: ${isLocalUrl}`);
    
    // Verificar se a URL contém o hostname do nosso servidor
    if (apiUrl && !isLocalUrl) {
      try {
        const apiHostname = new URL(apiUrl).hostname;
        isLocalUrl = mediaUrl.includes(apiHostname);
        console.log(`[BotManager] Verificando hostname ${apiHostname}: ${isLocalUrl}`);
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
      
      console.log(`[BotManager] Nome do arquivo extraído: ${fileName}`);
      
      if (fileName) {
        const filePath = join(this.UPLOAD_DIR, fileName);
        console.log(`[BotManager] UPLOAD_DIR: ${this.UPLOAD_DIR}`);
        console.log(`[BotManager] process.cwd(): ${process.cwd()}`);
        console.log(`[BotManager] Tentando ler arquivo: ${filePath}`);
        console.log(`[BotManager] Arquivo existe: ${existsSync(filePath)}`);
        
        // Tentar caminhos alternativos se o arquivo não for encontrado
        if (!existsSync(filePath)) {
          // Tentar caminho relativo
          const relativePath = join(process.cwd(), "uploads", fileName);
          console.log(`[BotManager] Tentando caminho relativo: ${relativePath}`);
          if (existsSync(relativePath)) {
            try {
              const fileBuffer = await readFile(relativePath);
              console.log(`[BotManager] Arquivo lido do caminho relativo: ${relativePath} (${fileBuffer.length} bytes)`);
              return new InputFile(fileBuffer, fileName);
            } catch (error) {
              console.error(`[BotManager] Erro ao ler arquivo ${relativePath}:`, error);
            }
          }
          
          // Tentar caminho absoluto do Docker
          const dockerPath = join("/app/backend/uploads", fileName);
          console.log(`[BotManager] Tentando caminho Docker: ${dockerPath}`);
          if (existsSync(dockerPath)) {
            try {
              const fileBuffer = await readFile(dockerPath);
              console.log(`[BotManager] Arquivo lido do caminho Docker: ${dockerPath} (${fileBuffer.length} bytes)`);
              return new InputFile(fileBuffer, fileName);
            } catch (error) {
              console.error(`[BotManager] Erro ao ler arquivo ${dockerPath}:`, error);
            }
          }
        } else {
          try {
            const fileBuffer = await readFile(filePath);
            console.log(`[BotManager] Arquivo lido com sucesso: ${filePath} (${fileBuffer.length} bytes)`);
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
        console.log(`[BotManager] Tentando baixar arquivo da URL: ${mediaUrl}`);
        // Usar URL interna do container para evitar problemas de rede
        const internalUrl = mediaUrl.replace(new URL(apiUrl).origin, `http://localhost:${process.env.PORT || 3000}`);
        console.log(`[BotManager] Tentando URL interna: ${internalUrl}`);
        const response = await fetch(internalUrl);
        console.log(`[BotManager] Resposta do fetch: ${response.status} ${response.statusText}`);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const fileName = mediaUrl.split("/").pop()?.split("?")[0] || "image.jpg";
          console.log(`[BotManager] Arquivo baixado com sucesso: ${fileName} (${arrayBuffer.byteLength} bytes)`);
          return new InputFile(Buffer.from(arrayBuffer), fileName);
        } else {
          console.error(`[BotManager] ERRO: Falha ao baixar arquivo: ${response.status} ${response.statusText}`);
          // Se não conseguir baixar, tentar ler do sistema de arquivos novamente com caminho absoluto
          if (fileName) {
            const absolutePath = join(this.UPLOAD_DIR, fileName);
            console.log(`[BotManager] Tentando ler arquivo novamente com caminho absoluto: ${absolutePath}`);
            if (existsSync(absolutePath)) {
              try {
                const fileBuffer = await readFile(absolutePath);
                console.log(`[BotManager] Arquivo lido do sistema de arquivos: ${absolutePath} (${fileBuffer.length} bytes)`);
                return new InputFile(fileBuffer, fileName);
              } catch (error) {
                console.error(`[BotManager] Erro ao ler arquivo ${absolutePath}:`, error);
              }
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
    console.log(`[BotManager] Retornando URL externa diretamente: ${mediaUrl}`);
    return mediaUrl;
  }

  async startBot(botId: string, token: string, config: BotConfig) {
    // Parar bot existente se houver
    await this.stopBot(botId);
    
    // Aguardar um pouco para garantir que o bot anterior foi completamente parado
    await new Promise(resolve => setTimeout(resolve, 2000));

    const bot = new Bot(token);
    const syncpay = new SyncPayService(config.syncpayApiKey, config.syncpayApiSecret);
    
    // Adicionar handler de erro global para capturar erros 409 durante o long polling
    bot.catch((error) => {
      const errorCode = (error as any).error_code || (error as any).error?.error_code;
      const errorDesc = (error as any).description || (error as any).error?.description || (error as any).message || '';
      
      if (errorCode === 409 || errorDesc.includes('409') || errorDesc.includes('Conflict')) {
        console.warn(`[Bot ${botId}] Erro 409 detectado durante long polling. Parando bot...`);
        this.stopBot(botId).catch(err => {
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
        console.log(`[Bot ${botId}] Enviando mensagem /start com ${config.paymentButtons.length} botões de pagamento`);
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
        console.log(`[Bot ${botId}] Enviando mensagem de reenvio com ${buttonsToUse.length} botões de pagamento`);
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

    // Função para iniciar reenvios automáticos
    const startResendSchedule = async (chatId: string) => {
      console.log(`[BotManager] Iniciando agendamento de reenvio para bot ${botId}, chat ${chatId}`);
      
      // Limpar timers existentes para este chat
      this.stopResendSchedule(botId, chatId);

      const firstDelay = (config.resendFirstDelay || 20) * 60 * 1000; // Converter minutos para ms
      const interval = (config.resendInterval || 10) * 60 * 1000; // Converter minutos para ms

      console.log(`[BotManager] Configuração de reenvio - Primeiro delay: ${config.resendFirstDelay || 20} minutos (${firstDelay}ms), Intervalo: ${config.resendInterval || 10} minutos (${interval}ms)`);

      // Primeira mensagem após o delay configurado
      const firstTimer = setTimeout(async () => {
        try {
          console.log(`[BotManager] Executando primeiro reenvio para bot ${botId}, chat ${chatId}`);
          
          // Verificar se o usuário já comprou
          const hasPurchased = await hasUserPurchased(chatId);
          if (hasPurchased) {
            console.log(`[BotManager] Usuário ${chatId} já comprou, parando reenvios`);
            this.stopResendSchedule(botId, chatId);
            return;
          }

          // Enviar mensagem de reenvio
          console.log(`[BotManager] Enviando primeira mensagem de reenvio para chat ${chatId}`);
          await sendResendMessage(chatId);
          console.log(`[BotManager] Primeira mensagem de reenvio enviada com sucesso para chat ${chatId}`);

          // Iniciar reenvios no intervalo configurado
          const recurringTimer = setInterval(async () => {
            try {
              console.log(`[BotManager] Executando reenvio recorrente para bot ${botId}, chat ${chatId}`);
              
              // Verificar se o usuário já comprou
              const hasPurchased = await hasUserPurchased(chatId);
              if (hasPurchased) {
                console.log(`[BotManager] Usuário ${chatId} já comprou, parando reenvios recorrentes`);
                this.stopResendSchedule(botId, chatId);
                return;
              }

              // Verificar se o bot ainda existe
              const bot = this.bots.get(botId);
              if (!bot) {
                console.warn(`[BotManager] Bot ${botId} não encontrado, parando reenvios`);
                clearInterval(recurringTimer);
                return;
              }

              // Enviar mensagem de reenvio
              console.log(`[BotManager] Enviando mensagem de reenvio recorrente para chat ${chatId}`);
              await sendResendMessage(chatId);
              console.log(`[BotManager] Mensagem de reenvio recorrente enviada com sucesso para chat ${chatId}`);
            } catch (error) {
              console.error(`[BotManager] Erro ao reenviar mensagem para chat ${chatId}:`, error);
              console.error(`[BotManager] Stack trace:`, (error as Error).stack);
            }
          }, interval);

          // Armazenar timer de reenvio recorrente
          if (!this.resendTimers.has(botId)) {
            this.resendTimers.set(botId, new Map());
          }
          this.resendTimers.get(botId)!.set(chatId, recurringTimer);
          console.log(`[BotManager] Timer de reenvio recorrente armazenado para bot ${botId}, chat ${chatId}`);
        } catch (error) {
          console.error(`[BotManager] Erro no primeiro reenvio para chat ${chatId}:`, error);
          console.error(`[BotManager] Stack trace:`, (error as Error).stack);
        }
      }, firstDelay);

      // Armazenar timer da primeira mensagem
      if (!this.resendTimers.has(botId)) {
        this.resendTimers.set(botId, new Map());
      }
      this.resendTimers.get(botId)!.set(`${chatId}_first`, firstTimer);
      console.log(`[BotManager] Timer da primeira mensagem armazenado para bot ${botId}, chat ${chatId} (será executado em ${firstDelay}ms)`);
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
        console.log(`[BotManager] Parâmetros recuperados do TrackingStorage para token: ${startParam}`);
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
              console.log(`[BotManager] Atualizando parâmetros de tracking do lead ${existingLead.id} (vindo de anúncio)`);
            } else {
              // Sem parâmetros de tracking - preservar dados antigos
              console.log(`[BotManager] Preservando parâmetros de tracking antigos do lead ${existingLead.id} (sem parâmetros no /start)`);
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
            console.log(`[BotManager] Novo lead criado com parâmetros de tracking:`, hasTrackingParams ? 'Sim' : 'Não');
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
      console.log(`Bot ${botId} iniciado com sucesso`);
    } catch (error: any) {
      console.error(`[Bot ${botId}] Erro ao iniciar bot:`, error);
      // Não lançar o erro para não quebrar o fluxo, mas logar
    }
  }

  // Parar reenvios para um chat específico
  stopResendSchedule(botId: string, chatId: string) {
    console.log(`[BotManager] Parando reenvios para bot ${botId}, chat ${chatId}`);
    const botTimers = this.resendTimers.get(botId);
    if (!botTimers) {
      console.log(`[BotManager] Nenhum timer encontrado para bot ${botId}`);
      return;
    }

    // Limpar timer da primeira mensagem
    const firstTimer = botTimers.get(`${chatId}_first`);
    if (firstTimer) {
      clearTimeout(firstTimer);
      botTimers.delete(`${chatId}_first`);
      console.log(`[BotManager] Timer da primeira mensagem removido para bot ${botId}, chat ${chatId}`);
    }

    // Limpar timer de reenvios recorrentes
    const recurringTimer = botTimers.get(chatId);
    if (recurringTimer) {
      clearInterval(recurringTimer);
      botTimers.delete(chatId);
      console.log(`[BotManager] Timer de reenvio recorrente removido para bot ${botId}, chat ${chatId}`);
    }

    // Se não houver mais timers para este bot, remover o Map
    if (botTimers.size === 0) {
      this.resendTimers.delete(botId);
      console.log(`[BotManager] Todos os timers removidos para bot ${botId}`);
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
        
        console.log(`Bot ${botId} parado`);
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
    
    // Aguardar um pouco antes de reiniciar todos
    await new Promise(resolve => setTimeout(resolve, 3000));

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
