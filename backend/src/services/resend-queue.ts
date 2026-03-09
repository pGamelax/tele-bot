import { Queue, Worker, Job } from "bullmq";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";

const prisma = new PrismaClient();

let botManagerInstance: any = null;
const getBotManager = async () => {
  if (!botManagerInstance) {
    const { BotManager } = await import("./bot-manager");
    botManagerInstance = BotManager.getInstance();
  }
  return botManagerInstance;
};

const redisConnection = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
    })
  : new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null,
    });

// Fila de reenvios
export const resendQueue = new Queue("resend-messages", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: {
      age: 3600,
      count: 1000,
    },
    removeOnFail: {
      age: 86400,
    },
  },
});

// Worker para processar reenvios
export const resendWorker = new Worker(
  "resend-messages",
  async (job: Job) => {
    const { botId, chatId, isFirst } = job.data;

    try {
      const bot = await prisma.bot.findUnique({
        where: { id: botId },
        select: {
          id: true,
          isActive: true,
          resendFirstDelay: true,
          resendInterval: true,
        },
      });

      if (!bot || !bot.isActive) {
        await removeResendJobs(botId, chatId);
        return { success: false, reason: "bot_inactive" };
      }

      const lead = await prisma.lead.findFirst({
        where: {
          botId,
          telegramChatId: chatId,
        },
      });

      if (!lead) {
        await removeResendJobs(botId, chatId);
        return { success: false, reason: "lead_not_found" };
      }

      if (lead.resendPaused) {
        return { success: false, reason: "paused" };
      }

      if (lead.isBlocked) {
        await removeResendJobs(botId, chatId);
        return { success: false, reason: "user_blocked" };
      }

      const paidPayment = await prisma.payment.findFirst({
        where: {
          botId,
          telegramChatId: chatId,
          status: "paid",
        },
      });

      if (paidPayment) {
        await removeResendJobs(botId, chatId);
        return { success: false, reason: "already_purchased" };
      }

      const botManager = await getBotManager();
      try {
        await botManager.sendResendMessage(botId, chatId);

        // Sempre agendar o próximo reenvio para manter o loop infinito
        const intervalMinutes = bot.resendInterval || 10;
        const interval = intervalMinutes * 60 * 1000;
        
        // Usar timestamp para garantir job único a cada execução
        const timestamp = Date.now();
        const recurringJobId = `resend-${botId}-${chatId}-recurring-${timestamp}`;
        
        // Remover jobs recorrentes antigos deste chat
        const existingJobs = await resendQueue.getJobs(["delayed", "waiting", "active"]);
        for (const existingJob of existingJobs) {
          if (existingJob.data.botId === botId && 
              existingJob.data.chatId === chatId && 
              !existingJob.data.isFirst) {
            try {
              await existingJob.remove();
            } catch (error) {
              // Ignorar erros se o job já foi removido
            }
          }
        }
        
        // Agendar o próximo reenvio (sempre usando resendInterval para manter o loop)
        await resendQueue.add(
          recurringJobId,
          { botId, chatId, isFirst: false },
          {
            delay: interval,
            jobId: recurringJobId,
          }
        );

        return { success: true };
      } catch (error: any) {
        // Verificar se é erro de bloqueio
        const errorCode = error?.error_code || error?.error?.error_code;
        const errorDesc = (error?.description || error?.error?.description || error?.message || "").toLowerCase();
        const isBlocked = (
          errorCode === 403 ||
          errorDesc.includes("bot was blocked") ||
          errorDesc.includes("chat not found") ||
          errorDesc.includes("user is deactivated") ||
          errorDesc.includes("forbidden") ||
          errorDesc.includes("blocked")
        );

        if (isBlocked) {
          // Marcar lead como bloqueado e remover jobs
          await prisma.lead.updateMany({
            where: {
              botId,
              telegramChatId: chatId,
            },
            data: {
              isBlocked: true,
            },
          });
          await removeResendJobs(botId, chatId);
          return { success: false, reason: "user_blocked" };
        }

        if (error.message?.includes("não encontrada") || error.message?.includes("não encontrado")) {
          await removeResendJobs(botId, chatId);
          return { success: false, reason: "bot_not_found" };
        }
        
        // Verificar se é erro de token inválido (401) - usando errorCode e errorDesc já declarados acima
        if (errorCode === 401 || errorDesc.includes("unauthorized") || error.message?.includes("Token inválido")) {
          console.warn(`⚠️  [ResendQueue] Token inválido para bot ${botId}. Pule este reenvio.`);
          await removeResendJobs(botId, chatId);
          return { success: false, reason: "invalid_token" };
        }
        
        console.error(`[ResendQueue] Erro ao enviar mensagem de reenvio:`, error?.message || error);
        return { success: false, reason: "send_error", error: error?.message || String(error) };
      }
    } catch (error) {
      console.error(`[ResendQueue] Erro ao processar reenvio:`, error);
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 10,
  }
);

/**
 * Agenda o primeiro reenvio. Quando executar, o primeiro envio agendará o próximo recorrente.
 */
export async function scheduleResends(
  botId: string,
  chatId: string,
  firstDelayMinutes: number,
  intervalMinutes: number
) {
  try {
    // Verificar se já existem jobs agendados antes de remover
    // Se existirem, é um /start subsequente e devemos usar resendInterval
    const existingJobs = await resendQueue.getJobs(["delayed", "waiting", "active"]);
    const hasExistingJobs = existingJobs.some(
      job => job.data.botId === botId && job.data.chatId === chatId
    );

    // Sempre remover todos os jobs existentes antes de agendar novos
    // Isso garante que um novo /start cancela os reenvios anteriores
    await removeResendJobs(botId, chatId);

    // Verificar se o usuário já comprou ou se o lead está pausado
    const lead = await prisma.lead.findFirst({
      where: {
        botId,
        telegramChatId: chatId,
      },
    });

    if (lead?.resendPaused) {
      return;
    }

    if (lead?.isBlocked) {
      return;
    }

    const paidPayment = await prisma.payment.findFirst({
      where: {
        botId,
        telegramChatId: chatId,
        status: "paid",
      },
    });

    if (paidPayment) {
      return;
    }

    // Se já existiam jobs agendados, é um /start subsequente
    // Usar resendInterval em vez de resendFirstDelay
    const delayToUse = hasExistingJobs ? intervalMinutes : firstDelayMinutes;
    const timestamp = Date.now();
    const firstJobId = `resend-${botId}-${chatId}-first-${timestamp}`;
    const delay = delayToUse * 60 * 1000;
    
    await resendQueue.add(
      firstJobId,
      { botId, chatId, isFirst: true },
      {
        delay: delay,
        jobId: firstJobId,
      }
    );
  } catch (error) {
    console.error(`[ResendQueue] Erro ao agendar reenvios:`, error);
    throw error;
  }
}

/**
 * Remove jobs de reenvio para um bot/chat específico ou todos os jobs de um bot.
 */
export async function removeResendJobs(botId: string, chatId?: string) {
  try {
    const repeatableJobs = await resendQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      const shouldRemove = chatId 
        ? job.id?.includes(`resend-${botId}-${chatId}`)
        : job.id?.includes(`resend-${botId}-`);
      
      if (shouldRemove) {
        try {
          await resendQueue.removeRepeatableByKey(job.key);
        } catch (error) {
          // Ignorar erros se o job já foi removido
        }
      }
    }

    const jobs = await resendQueue.getJobs(["delayed", "waiting", "active"]);
    
    for (const job of jobs) {
      const shouldRemove = chatId
        ? (job.data.botId === botId && job.data.chatId === chatId) ||
          (job.id && chatId && job.id.includes(`resend-${botId}-${chatId}`))
        : job.data.botId === botId || (job.id && job.id.includes(`resend-${botId}-`));
      
      if (shouldRemove) {
        try {
          await job.remove();
        } catch (error) {
          // Ignorar erros se o job já foi removido
        }
      }
    }
  } catch (error) {
    console.error(`[ResendQueue] Erro ao remover jobs:`, error);
  }
}

/**
 * Reagenda todos os jobs de um bot quando os tempos de reenvio são atualizados.
 */
export async function rescheduleBotResends(botId: string) {
  try {
    const bot = await prisma.bot.findUnique({
      where: { id: botId },
      select: {
        id: true,
        isActive: true,
        resendFirstDelay: true,
        resendInterval: true,
      },
    });

    if (!bot || !bot.isActive) {
      await removeResendJobs(botId);
      return;
    }

    const activeLeads = await prisma.lead.findMany({
      where: {
        botId,
        convertedAt: null,
        resendPaused: false,
        isBlocked: false,
      },
    });

    await removeResendJobs(botId);

    for (const lead of activeLeads) {
      const paidPayment = await prisma.payment.findFirst({
        where: {
          botId,
          telegramChatId: lead.telegramChatId,
          status: "paid",
        },
      });

      if (!paidPayment) {
        await scheduleResends(
          botId,
          lead.telegramChatId,
          bot.resendFirstDelay || 20,
          bot.resendInterval || 10
        );
      }
    }
  } catch (error) {
    console.error(`[ResendQueue] Erro ao reagendar jobs:`, error);
  }
}

/**
 * Restaura reenvios ao iniciar o sistema.
 */
export async function restoreResends() {
  const activeLeads = await prisma.lead.findMany({
    where: {
      convertedAt: null,
    },
    include: {
      bot: {
        select: {
          id: true,
          isActive: true,
          resendFirstDelay: true,
          resendInterval: true,
        },
      },
    },
  });

  for (const lead of activeLeads) {
    const paidPayment = await prisma.payment.findFirst({
      where: {
        botId: lead.botId,
        telegramChatId: lead.telegramChatId,
        status: "paid",
      },
    });

    if (paidPayment || !lead.bot.isActive) {
      continue;
    }

    if ((lead as any).resendPaused === true) {
      continue;
    }

    if ((lead as any).isBlocked === true) {
      continue;
    }

    await scheduleResends(
      lead.botId,
      lead.telegramChatId,
      lead.bot.resendFirstDelay || 20,
      lead.bot.resendInterval || 10
    );
  }
}

resendWorker.on("failed", (job, err) => {
  console.error(`[ResendQueue] Job falhou:`, err);
});

resendWorker.on("error", (err) => {
  console.error(`[ResendQueue] Erro no worker:`, err);
});
