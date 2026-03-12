import { PrismaClient } from "@prisma/client";
import { Bot, InputFile } from "grammy";
import { scheduleResends } from "./resend-queue";
import QRCode from "qrcode";

const prisma = new PrismaClient();

const RECOVERY_1_MINUTES = 10;   // 1º lembrete: 10 min após gerar PIX
const RECOVERY_2_MINUTES = 30;   // 2º lembrete: 30 min após gerar PIX
const RESUME_RESEND_AFTER_MINUTES = 10; // Retoma reenvio 10 min após o 1º lembrete

async function sendRecoveryMessage(
  bot: any,
  payment: any,
  messageTemplate: string,
  label: string
) {
  const telegramBot = new Bot(bot.telegramToken);
  const amountFormatted = (payment.amount / 100).toFixed(2);
  const message = messageTemplate
    .replace(/\{amount\}/g, amountFormatted)
    .replace(/\{pixCode\}/g, payment.pixCode || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  const verifyButton = {
    inline_keyboard: [
      [{ text: "✅ Já paguei — Verificar", callback_data: `verify_payment_${payment.id}` }],
    ],
  };

  // Send QR code image
  try {
    const qrBuffer = await QRCode.toBuffer(payment.pixCode, {
      errorCorrectionLevel: "M",
      width: 512,
      margin: 2,
    });
    await telegramBot.api.sendPhoto(parseInt(payment.telegramChatId), new InputFile(qrBuffer, "qrcode.png"), {
      caption: "📷 Escaneie o QR Code para pagar",
    });
  } catch (qrErr) {
    console.error(`[PixRecovery] Erro ao enviar QR Code:`, qrErr);
  }

  // Send reminder text + verify button
  await telegramBot.api.sendMessage(parseInt(payment.telegramChatId), message, {
    parse_mode: "Markdown",
    reply_markup: verifyButton,
  });

  console.log(`[PixRecovery] ${label} enviado para payment ${payment.id}`);
}

/**
 * Envia lembretes para quem gerou PIX e não pagou.
 * Fluxo:
 *   PIX gerado → para reenvio
 *   → 10 min: 1º lembrete (QR + texto + botão verificar)
 *   → 20 min: retoma reenvio normal
 *   → 30 min: 2º lembrete mais urgente (QR + texto + botão verificar)
 *
 * Executa a cada 2 minutos.
 */
export function startPixRecoveryScheduler() {
  const runRecovery = async () => {
    try {
      const now = new Date();

      // ── 1º lembrete (10 min após gerar PIX) ──────────────────────────────
      const paymentsToRecover1 = await prisma.payment.findMany({
        where: {
          status: "pending",
          pixCode: { not: null },
          pixRecoverySentAt: null,
        },
        include: { bot: true },
      });

      for (const payment of paymentsToRecover1) {
        const bot = payment.bot as any;
        if (!bot?.pixRecoveryEnabled) continue;

        const delayMinutes = bot.pixRecoveryDelayMinutes || RECOVERY_1_MINUTES;
        const recoveryTime = new Date(payment.createdAt.getTime() + delayMinutes * 60 * 1000);
        if (now < recoveryTime) continue;

        try {
          const template =
            bot.pixRecoveryMessage ||
            `⏰ Não esqueça! Seu PIX de R$ {amount} ainda está esperando.\n\nCopie o código abaixo e pague pelo app do seu banco:\n\n\`{pixCode}\``;

          await sendRecoveryMessage(bot, payment, template, "1º lembrete");

          await prisma.payment.update({
            where: { id: payment.id },
            data: { pixRecoverySentAt: new Date() },
          });
        } catch (err: any) {
          console.error(`[PixRecovery] Erro no 1º lembrete para ${payment.telegramChatId}:`, err?.message);
        }
      }

      // ── Retomar reenvio (10 min após o 1º lembrete) ───────────────────────
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
        const resumeTime = new Date(
          payment.pixRecoverySentAt!.getTime() + RESUME_RESEND_AFTER_MINUTES * 60 * 1000
        );
        if (now < resumeTime) continue;

        try {
          const interval = bot.resendInterval ?? 10;
          await scheduleResends(payment.botId, payment.telegramChatId, interval, interval);

          await prisma.payment.update({
            where: { id: payment.id },
            data: { resendResumedAt: new Date() },
          });

          console.log(`[PixRecovery] Reenvio retomado para payment ${payment.id}`);
        } catch (err: any) {
          console.error(`[PixRecovery] Erro ao retomar reenvio:`, err?.message);
        }
      }

      // ── 2º lembrete (30 min após gerar PIX) ──────────────────────────────
      const paymentsToRecover2 = await prisma.payment.findMany({
        where: {
          status: "pending",
          pixCode: { not: null },
          pixRecoverySentAt: { not: null },  // já recebeu o 1º
          pixRecovery2SentAt: null,
        },
        include: { bot: true },
      });

      for (const payment of paymentsToRecover2) {
        const bot = payment.bot as any;
        if (!bot?.pixRecoveryEnabled) continue;

        const recovery2Time = new Date(payment.createdAt.getTime() + RECOVERY_2_MINUTES * 60 * 1000);
        if (now < recovery2Time) continue;

        try {
          const amountFormatted = (payment.amount / 100).toFixed(2);
          const template =
            `🚨 Última chance! Seu acesso de R$ {amount} ainda está reservado.\n\nSeu PIX expira em breve — pague agora e garanta seu acesso:\n\n\`{pixCode}\``;

          await sendRecoveryMessage(bot, payment, template, "2º lembrete");

          await prisma.payment.update({
            where: { id: payment.id },
            data: { pixRecovery2SentAt: new Date() },
          });
        } catch (err: any) {
          console.error(`[PixRecovery] Erro no 2º lembrete para ${payment.telegramChatId}:`, err?.message);
        }
      }
    } catch (error: any) {
      console.error("[PixRecovery] Erro:", error?.message);
    }
  };

  runRecovery();
  setInterval(runRecovery, 2 * 60 * 1000); // A cada 2 minutos
}
