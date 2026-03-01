import { Elysia } from "elysia";
import { PrismaClient } from "@prisma/client";
import { BotManager } from "../services/bot-manager";
import { FacebookConversionsService } from "../services/facebook-conversions";

const prisma = new PrismaClient();
const botManager = BotManager.getInstance();
const facebookConversions = new FacebookConversionsService();

export const webhookRoutes = new Elysia({ prefix: "/api/webhooks" })
  .post("/syncpay", async ({ body, headers, set }) => {
    try {

      // Formato da SyncPay conforme documentação:
      // Header: event = "cashin.update" ou "cashin.create"
      // Body: { data: { id, status, amount, ... } }
      const webhookData = body as any;
      const event = headers.event || (headers as any)["x-event"] || (headers as any)["X-Event"] || webhookData.event;

      // Extrair dados do payload primeiro para verificar o status
      const data = webhookData.data || webhookData;
      const status = data.status;
      const statusUpper = (status || "").toUpperCase();
      

      // Ignorar cashin.create apenas se o status não for de pagamento confirmado
      // Se o status for PAID_OUT ou similar, processar mesmo que seja cashin.create
      const isPaidStatus = 
        statusUpper === "PAID_OUT" || 
        statusUpper === "PAID" || 
        statusUpper === "PAGO" || 
        statusUpper === "APPROVED" || 
        statusUpper === "APROVADO" ||
        statusUpper === "CONFIRMED" ||
        statusUpper === "CONFIRMADO";
      
      if (event && event === "cashin.create" && !isPaidStatus) {
        // Ignorar cashin.create apenas se não for um status de pagamento confirmado
        set.status = 200;
        return { message: "Evento ignorado - pagamento ainda não confirmado" };
      }
      
      if (!data.id && !data.idtransaction && !data.identifier && !data.externalreference) {
        console.error("[Webhook SyncPay] Nenhum identificador encontrado na notificação");
        set.status = 400;
        return { error: "id é obrigatório" };
      }

      const identifier = data.id || data.idtransaction || data.identifier;
      const externalReference = data.externalreference;
      
      // Buscar pagamento pelo syncpayId (identifier)
      let payment = await prisma.payment.findFirst({
        where: {
          syncpayId: identifier,
        },
      });

      // Se não encontrou, tentar buscar por idtransaction
      if (!payment && data.idtransaction && data.idtransaction !== identifier) {
        payment = await prisma.payment.findFirst({
          where: {
            syncpayId: data.idtransaction,
          },
        });
      }

      // Se ainda não encontrou, tentar buscar pelo externalreference (que pode ser o ID do pagamento)
      if (!payment && externalReference) {
        // externalReference pode ser o ID do pagamento no nosso banco
        try {
          payment = await prisma.payment.findUnique({
            where: {
              id: externalReference,
            },
          });
        } catch (e) {
          // Se não for um ID válido, ignorar
        }
      }

      if (!payment) {
        console.warn(`[Webhook SyncPay] Pagamento não encontrado para identifier: ${identifier}, externalReference: ${externalReference}`);
        set.status = 404;
        return { error: "Pagamento não encontrado", identifier, externalReference };
      }


      // Mapear status da SyncPay para nosso formato
      // Status possíveis: PAID_OUT, WAITING_FOR_APPROVAL, APPROVED, PAID, EXPIRED, CANCELLED, etc.
      // statusUpper já foi declarado anteriormente
      let newStatus: "pending" | "paid" | "expired" | "cancelled" = "pending";
      
      // Status que indicam pagamento confirmado
      if (
        statusUpper === "PAID_OUT" || // Status correto para pagamento pago
        statusUpper === "PAID" || 
        statusUpper === "PAGO" || 
        statusUpper === "APPROVED" || 
        statusUpper === "APROVADO" ||
        statusUpper === "WAITING_FOR_APPROVAL" ||
        statusUpper === "CONFIRMED" ||
        statusUpper === "CONFIRMADO" ||
        data.paid === true
      ) {
        newStatus = "paid";
      } else if (
        statusUpper === "EXPIRED" || 
        statusUpper === "EXPIrado" || 
        statusUpper === "EXPIRADO" ||
        data.expired === true
      ) {
        newStatus = "expired";
      } else if (
        statusUpper === "CANCELLED" || 
        statusUpper === "CANCELED" || 
        statusUpper === "CANCELADO" || 
        statusUpper === "CANCEL" ||
        data.cancelled === true
      ) {
        newStatus = "cancelled";
      } else {
        newStatus = "pending";
      }
      

      // Atualizar status do pagamento (mesmo se já estiver como paid, para garantir que tudo seja processado)
      const shouldUpdate = payment.status !== newStatus;
      const isPaid = newStatus === "paid";
      
      if (shouldUpdate) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: newStatus,
            paidAt: isPaid ? new Date() : payment.paidAt,
          },
        });
      } else if (isPaid) {
        // Se já está como paid, processar mesmo assim para garantir que mensagem e lead sejam atualizados
      } else {
        set.status = 200;
        return { message: "Status já atualizado", paymentId: payment.id, status: newStatus };
      }

      // Se o pagamento foi confirmado (paid) - processar mesmo se já estava como paid
      if (isPaid) {
        // Buscar lead com todos os campos de tracking
        const lead = await prisma.lead.findFirst({
          where: {
            botId: payment.botId,
            telegramChatId: payment.telegramChatId,
          },
          select: {
            id: true,
            fbclid: true,
            utmSource: true,
            utmMedium: true,
            utmCampaign: true,
            utmContent: true,
            utmTerm: true,
            gclid: true,
            ref: true,
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
        } else {
          console.warn(`[Webhook SyncPay] Lead não encontrado para bot ${payment.botId} e chat ${payment.telegramChatId}`);
        }

        // Parar reenvios para este chat
        await botManager.stopResendSchedule(payment.botId, payment.telegramChatId);

        // Enviar evento para Facebook Conversions API
        try {
          const bot = await prisma.bot.findUnique({
            where: { id: payment.botId },
            select: {
              facebookPixelId: true,
              facebookAccessToken: true,
            },
          });

          if (bot?.facebookPixelId && bot?.facebookAccessToken) {
            const amountInReais = payment.amount / 100;
            const eventTime = payment.paidAt 
              ? Math.floor(payment.paidAt.getTime() / 1000)
              : Math.floor(Date.now() / 1000);

            // Enviar evento com fbclid do lead (parâmetros são salvos permanentemente no lead)
            await facebookConversions.sendPurchase(
              bot.facebookPixelId,
              bot.facebookAccessToken,
              amountInReais,
              lead?.fbclid || undefined,
              eventTime
            );
          } else {
            if (!bot?.facebookPixelId) {
            }
            if (!bot?.facebookAccessToken) {
            }
          }
        } catch (facebookError: any) {
          console.error("[Webhook SyncPay] Erro ao enviar evento para Facebook:", {
            error: facebookError?.message,
            stack: facebookError?.stack?.substring(0, 300),
          });
          // Não falhar o webhook se houver erro ao enviar para Facebook
        }

        // Notificar o usuário no Telegram
        try {
          const bot = await prisma.bot.findUnique({
            where: { id: payment.botId },
          });

          if (bot && bot.isActive) {
            const { Bot } = await import("grammy");
            const telegramBot = new Bot(bot.telegramToken);
            
            // Usar mensagem configurada ou mensagem padrão
            const message = bot.paymentConfirmedMessage 
              ? bot.paymentConfirmedMessage.replace(/\{amount\}/g, (payment.amount / 100).toFixed(2))
              : `✅ Pagamento confirmado! Obrigado pela compra de R$ ${(payment.amount / 100).toFixed(2)}.`;
            
            // Normalizar quebras de linha
            const normalizedMessage = message.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            
            await telegramBot.api.sendMessage(
              parseInt(payment.telegramChatId),
              normalizedMessage
            );
            
          }
        } catch (telegramError: any) {
          console.error("[Webhook SyncPay] Erro ao enviar notificação no Telegram:", {
            error: telegramError?.message,
            stack: telegramError?.stack?.substring(0, 300),
          });
          // Não falhar o webhook se houver erro ao enviar mensagem
        }
      }

      set.status = 200;
      return {
        message: "Webhook processado com sucesso",
        paymentId: payment.id,
        status: newStatus,
      };
    } catch (error: any) {
      console.error("[Webhook SyncPay] Erro ao processar webhook:", {
        error: error.message,
        stack: error.stack?.substring(0, 500),
        body: JSON.stringify(body, null, 2),
      });
      
      set.status = 500;
      return { error: "Erro ao processar webhook" };
    }
  });
