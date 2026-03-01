import { Queue, Worker, Job } from "bullmq";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";

const prisma = new PrismaClient();

// Lazy loading do BotManager para evitar dependência circular
let botManagerInstance: any = null;
const getBotManager = async () => {
  if (!botManagerInstance) {
    const { BotManager } = await import("./bot-manager");
    botManagerInstance = BotManager.getInstance();
  }
  return botManagerInstance;
};

// Configuração do Redis
// Suporta REDIS_URL ou variáveis individuais (host, port, password)
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
      age: 3600, // Manter jobs completos por 1 hora
      count: 1000,
    },
    removeOnFail: {
      age: 86400, // Manter jobs falhos por 24 horas
    },
  },
});

// Worker para processar reenvios
export const resendWorker = new Worker(
  "resend-messages",
  async (job: Job) => {
    const { botId, chatId } = job.data;

    try {
      // Verificar se o lead existe e se está pausado
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

      // Verificar se está pausado manualmente
      if (lead.resendPaused) {
        return { success: false, reason: "paused" };
      }

      // Verificar se o usuário já comprou neste bot específico
      const paidPayment = await prisma.payment.findFirst({
        where: {
          botId,
          telegramChatId: chatId,
          status: "paid",
        },
      });

      if (paidPayment) {
        // Remover todos os jobs futuros para este bot/chat
        await removeResendJobs(botId, chatId);
        return { success: false, reason: "already_purchased" };
      }

      // Verificar se o bot ainda está ativo
      const bot = await prisma.bot.findUnique({
        where: { id: botId },
      });

      if (!bot || !bot.isActive) {
        // Remover jobs se o bot não existe mais ou está inativo
        await removeResendJobs(botId, chatId);
        return { success: false, reason: "bot_inactive" };
      }

      // Enviar mensagem de reenvio através do BotManager (lazy loading)
      const botManager = await getBotManager();
      try {
        await botManager.sendResendMessage(botId, chatId);
      } catch (error: any) {
        // Se o bot não existe mais no BotManager, remover jobs
        if (error.message?.includes("não encontrada") || error.message?.includes("não encontrado")) {
          await removeResendJobs(botId, chatId);
          return { success: false, reason: "bot_not_found" };
        }
        throw error;
      }

      return { success: true };
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

// Função para agendar reenvios
export async function scheduleResends(
  botId: string,
  chatId: string,
  firstDelayMinutes: number,
  intervalMinutes: number
) {
  // Remover jobs antigos para este bot/chat
  await removeResendJobs(botId, chatId);

  // Agendar primeiro reenvio
  const firstDelay = firstDelayMinutes * 60 * 1000; // Converter para ms
  await resendQueue.add(
    `resend-${botId}-${chatId}-first`,
    { botId, chatId },
    {
      delay: firstDelay,
      jobId: `resend-${botId}-${chatId}-first`,
    }
  );

  // Agendar reenvios recorrentes
  const interval = intervalMinutes * 60 * 1000; // Converter para ms
  await resendQueue.add(
    `resend-${botId}-${chatId}-recurring`,
    { botId, chatId },
    {
      repeat: {
        every: interval,
        immediately: false,
      },
      jobId: `resend-${botId}-${chatId}-recurring`,
    }
  );

}

// Função para remover jobs de reenvio
export async function removeResendJobs(botId: string, chatId: string) {
  // Primeiro, remover jobs repetitivos usando removeRepeatableByKey
  const repeatableJobs = await resendQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    if (job.id?.includes(`resend-${botId}-${chatId}`)) {
      try {
        await resendQueue.removeRepeatableByKey(job.key);
      } catch (error) {
        // Ignorar erros se o job já foi removido
      }
    }
  }

  // Depois, remover jobs regulares (delayed, waiting)
  const jobs = await resendQueue.getJobs(["delayed", "waiting"]);
  
  for (const job of jobs) {
    if (job.data.botId === botId && job.data.chatId === chatId) {
      try {
        await job.remove();
      } catch (error) {
        // Ignorar erros se o job já foi removido ou não pode ser removido
      }
    }
  }
}

// Função para restaurar reenvios ao iniciar o sistema
export async function restoreResends() {

  const activeLeads = await prisma.lead.findMany({
    where: {
      // resendPaused: false, // Temporariamente comentado até migração ser executada
      convertedAt: null, // Não convertidos
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
    // Verificar se já comprou neste bot
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

    // Verificar se está pausado (se o campo existir)
    // @ts-ignore - Campo pode não existir até migração ser executada
    if ((lead as any).resendPaused === true) {
      continue;
    }

    // Agendar reenvios
    await scheduleResends(
      lead.botId,
      lead.telegramChatId,
      lead.bot.resendFirstDelay || 20,
      lead.bot.resendInterval || 10
    );
  }

}

// Tratamento de erros do worker
resendWorker.on("failed", (job, err) => {
  console.error(`[ResendQueue] Job ${job?.id} falhou:`, err);
});

resendWorker.on("error", (err) => {
  console.error(`[ResendQueue] Erro no worker:`, err);
});
