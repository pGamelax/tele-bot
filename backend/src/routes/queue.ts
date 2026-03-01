import { Elysia } from "elysia";
import { auth } from "../lib/auth";
import { resendQueue } from "../services/resend-queue";

export const queueRoutes = new Elysia({ prefix: "/api/queue" })
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
  .get("/stats", async ({ user, set }) => {
    try {
      if (!user) {
        set.status = 401;
        return { error: "Não autorizado" };
      }

      // Obter estatísticas da fila
      const [waiting, active, completed, failed, delayed, repeatable] = await Promise.all([
        resendQueue.getWaitingCount(),
        resendQueue.getActiveCount(),
        resendQueue.getCompletedCount(),
        resendQueue.getFailedCount(),
        resendQueue.getDelayedCount(),
        resendQueue.getRepeatableJobs().then(jobs => jobs.length),
      ]);

      return {
        stats: {
          waiting,
          active,
          completed,
          failed,
          delayed,
          repeatable,
          total: waiting + active + completed + failed + delayed + repeatable,
        },
      };
    } catch (error: any) {
      set.status = 500;
      return { error: error.message || "Erro ao buscar estatísticas da fila" };
    }
  })
  .get("/jobs", async ({ user, query, set }) => {
    try {
      if (!user) {
        set.status = 401;
        return { error: "Não autorizado" };
      }

      const status = (query.status as string) || "all";
      const limit = parseInt((query.limit as string) || "50");
      const start = parseInt((query.start as string) || "0");

      let jobs: any[] = [];

      if (status === "all" || status === "waiting") {
        const waiting = await resendQueue.getJobs(["waiting"], start, start + limit - 1);
        jobs.push(...waiting.map(job => ({
          id: job.id,
          name: job.name,
          data: job.data,
          status: "waiting",
          timestamp: job.timestamp,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
        })));
      }

      if (status === "all" || status === "active") {
        const active = await resendQueue.getJobs(["active"], start, start + limit - 1);
        jobs.push(...active.map(job => ({
          id: job.id,
          name: job.name,
          data: job.data,
          status: "active",
          timestamp: job.timestamp,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
        })));
      }

      if (status === "all" || status === "completed") {
        const completed = await resendQueue.getJobs(["completed"], start, start + limit - 1);
        jobs.push(...completed.map(job => ({
          id: job.id,
          name: job.name,
          data: job.data,
          status: "completed",
          timestamp: job.timestamp,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
        })));
      }

      if (status === "all" || status === "failed") {
        const failed = await resendQueue.getJobs(["failed"], start, start + limit - 1);
        jobs.push(...failed.map(job => ({
          id: job.id,
          name: job.name,
          data: job.data,
          status: "failed",
          timestamp: job.timestamp,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
          failedReason: job.failedReason,
        })));
      }

      if (status === "all" || status === "delayed") {
        const delayed = await resendQueue.getJobs(["delayed"], start, start + limit - 1);
        jobs.push(...delayed.map(job => ({
          id: job.id,
          name: job.name,
          data: job.data,
          status: "delayed",
          timestamp: job.timestamp,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
          delay: job.delay,
        })));
      }

      if (status === "repeatable") {
        const repeatable = await resendQueue.getRepeatableJobs();
        jobs.push(...repeatable.map(job => ({
          id: job.id,
          key: job.key,
          name: job.name,
          next: job.next,
          status: "repeatable",
        })));
      }

      // Ordenar por timestamp (mais recente primeiro)
      jobs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      return {
        jobs: jobs.slice(0, limit),
        total: jobs.length,
      };
    } catch (error: any) {
      set.status = 500;
      return { error: error.message || "Erro ao buscar jobs" };
    }
  })
  .get("/repeatable", async ({ user, set }) => {
    try {
      if (!user) {
        set.status = 401;
        return { error: "Não autorizado" };
      }

      const repeatableJobs = await resendQueue.getRepeatableJobs();
      
      return {
        jobs: repeatableJobs.map(job => ({
          id: job.id,
          key: job.key,
          name: job.name,
          next: job.next,
          cron: job.cron,
          tz: job.tz,
          startDate: job.startDate,
          endDate: job.endDate,
        })),
        total: repeatableJobs.length,
      };
    } catch (error: any) {
      set.status = 500;
      return { error: error.message || "Erro ao buscar jobs repetitivos" };
    }
  });
