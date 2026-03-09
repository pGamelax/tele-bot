import { PrismaClient } from "@prisma/client";
import { Bot } from "grammy";
import { scheduleResends } from "./resend-queue";

const prisma = new PrismaClient();

const RECOVERY_DELAY_MINUTES = 10;  // 10 min após PIX: enviar recuperação
const RESUME_RESEND_AFTER_RECOVERY_MINUTES = 10;  // 10 min após recuperação: retomar reenvio (total 20 min)

/**
 * Envia lembretes para quem gerou PIX e não pagou.
 * Fluxo: PIX gerado → para reenvio → 10 min: recuperação → +10 min: retoma reenvio se não pagou.
 * Executa a cada 2 minutos.
 */
export function startPixRecoveryScheduler() {
  const runRecovery = async () => {
    try {
      const now = new Date();

      // 1. Enviar recuperação de PIX (10 min após gerar)
      const paymentsToRecover = await prisma.payment.findMany({
        where: {
          status: "pending",
          pixCode: { not: null },
          pixRecoverySentAt: null,
        },
        include: { bot: true },
      });

      for (const payment of paymentsToRecover) {
        const bot = payment.bot as any;
        if (!bot?.pixRecoveryEnabled) continue;

        const delayMinutes = bot.pixRecoveryDelayMinutes ?? RECOVERY_DELAY_MINUTES;
        const recoveryTime = new Date(payment.createdAt.getTime() + delayMinutes * 60 * 1000);
        if (now >= recoveryTime) {
          try {
            const telegramBot = new Bot(bot.telegramToken);
            const amountFormatted = (payment.amount / 100).toFixed(2);
            const message = (bot.pixRecoveryMessage ||
              `⏰ Não esqueça! Seu PIX de R$ {amount} ainda está válido.\n\nCódigo PIX:\n\`{pixCode}\`\n\nCopie e pague no app do seu banco!`)
              .replace(/\{amount\}/g, amountFormatted)
              .replace(/\{pixCode\}/g, payment.pixCode || "")
              .replace(/\r\n/g, "\n")
              .replace(/\r/g, "\n");

            await telegramBot.api.sendMessage(parseInt(payment.telegramChatId), message, {
              parse_mode: "Markdown",
            });

            await prisma.payment.update({
              where: { id: payment.id },
              data: { pixRecoverySentAt: new Date() },
            });

            console.log(`[PixRecovery] Lembrete enviado para payment ${payment.id}`);
          } catch (err: any) {
            console.error(`[PixRecovery] Erro ao enviar para ${payment.telegramChatId}:`, err?.message);
          }
        }
      }

      // 2. Retomar reenvio (10 min após recuperação = 20 min após PIX)
      const paymentsToResume = await prisma.payment.findMany({
        where: {
          status: "pending",
          pixRecoverySentAt: { not: null },
          resendResumedAt: null,
        },
        include: { bot: true },
      });

      for (const payment of paymentsToResume) {
        const bot = payment.bot as any;
        const recoverySentAt = payment.pixRecoverySentAt!;
        const resumeTime = new Date(
          recoverySentAt.getTime() + RESUME_RESEND_AFTER_RECOVERY_MINUTES * 60 * 1000
        );

        if (now >= resumeTime) {
          try {
            const firstDelay = bot.resendFirstDelay ?? 20;
            const interval = bot.resendInterval ?? 10;
            await scheduleResends(
              payment.botId,
              payment.telegramChatId,
              interval, // Usar interval pois é continuação do ciclo
              interval
            );

            await prisma.payment.update({
              where: { id: payment.id },
              data: { resendResumedAt: new Date() },
            });

            console.log(`[PixRecovery] Reenvio retomado para payment ${payment.id}`);
          } catch (err: any) {
            console.error(`[PixRecovery] Erro ao retomar reenvio:`, err?.message);
          }
        }
      }
    } catch (error: any) {
      console.error("[PixRecovery] Erro:", error?.message);
    }
  };

  runRecovery();
  setInterval(runRecovery, 2 * 60 * 1000); // A cada 2 minutos
}
