import { Elysia } from "elysia";
import { PrismaClient } from "@prisma/client";
import { TrackingStorage } from "../services/tracking-storage";

const prisma = new PrismaClient();
const trackingStorage = TrackingStorage.getInstance();

/**
 * Rota para capturar parâmetros de tracking e gerar link para Telegram
 * 
 * Uso:
 * GET /api/tracking/:botId?fbclid=xxx&utm_source=facebook&utm_campaign=ads
 * 
 * Retorna um link do Telegram com token que contém os parâmetros
 */
export const trackingRoutes = new Elysia({ prefix: "/api/tracking" })
  .get("/:botId", async ({ params, query, set }) => {
    try {
      const { botId } = params as { botId: string };

      // Buscar bot no banco
      const bot = await prisma.bot.findUnique({
        where: { id: botId },
        select: {
          id: true,
          telegramToken: true,
          name: true,
        },
      });

      if (!bot) {
        set.status = 404;
        return { error: "Bot não encontrado" };
      }

      // Extrair parâmetros de tracking da query string
      const trackingParams: {
        utmSource?: string;
        utmMedium?: string;
        utmCampaign?: string;
        utmContent?: string;
        utmTerm?: string;
        fbclid?: string;
        gclid?: string;
        ref?: string;
      } = {};

      // Mapear parâmetros da query string
      if (query.utm_source) trackingParams.utmSource = String(query.utm_source);
      if (query.utm_medium) trackingParams.utmMedium = String(query.utm_medium);
      if (query.utm_campaign) trackingParams.utmCampaign = String(query.utm_campaign);
      if (query.utm_content) trackingParams.utmContent = String(query.utm_content);
      if (query.utm_term) trackingParams.utmTerm = String(query.utm_term);
      if (query.fbclid) trackingParams.fbclid = String(query.fbclid);
      if (query.gclid) trackingParams.gclid = String(query.gclid);
      if (query.ref) trackingParams.ref = String(query.ref);

      // Verificar se há pelo menos um parâmetro de tracking
      const hasTrackingParams = Object.keys(trackingParams).length > 0;

      if (!hasTrackingParams) {
        // Se não houver parâmetros, retornar link direto do bot
        const botInfo = await fetch(`https://api.telegram.org/bot${bot.telegramToken}/getMe`).then(r => r.json());
        const botUsername = botInfo.result?.username;

        if (!botUsername) {
          set.status = 500;
          return { error: "Erro ao obter informações do bot" };
        }

        return {
          telegramUrl: `https://t.me/${botUsername}`,
          directLink: true,
        };
      }

      // Armazenar parâmetros e gerar token
      const token = trackingStorage.store(trackingParams);

      // Obter username do bot
      const botInfo = await fetch(`https://api.telegram.org/bot${bot.telegramToken}/getMe`).then(r => r.json());
      const botUsername = botInfo.result?.username;

      if (!botUsername) {
        set.status = 500;
        return { error: "Erro ao obter informações do bot" };
      }

      // Gerar link do Telegram com token
      const telegramUrl = `https://t.me/${botUsername}?start=${token}`;

      console.log(`[Tracking] Link gerado para bot ${botId}: ${telegramUrl}`);
      console.log(`[Tracking] Parâmetros capturados:`, trackingParams);

      return {
        telegramUrl,
        token,
        trackingParams,
        directLink: false,
      };
    } catch (error: any) {
      console.error("[Tracking] Erro ao gerar link:", error);
      set.status = 500;
      return { error: error.message || "Erro ao gerar link de tracking" };
    }
  })
  // Rota alternativa que redireciona diretamente para o Telegram
  .get("/:botId/redirect", async ({ params, query, set }) => {
    try {
      const { botId } = params as { botId: string };

      // Buscar bot no banco
      const bot = await prisma.bot.findUnique({
        where: { id: botId },
        select: {
          id: true,
          telegramToken: true,
        },
      });

      if (!bot) {
        set.status = 404;
        return { error: "Bot não encontrado" };
      }

      // Extrair parâmetros de tracking
      const trackingParams: any = {};
      if (query.utm_source) trackingParams.utmSource = String(query.utm_source);
      if (query.utm_medium) trackingParams.utmMedium = String(query.utm_medium);
      if (query.utm_campaign) trackingParams.utmCampaign = String(query.utm_campaign);
      if (query.utm_content) trackingParams.utmContent = String(query.utm_content);
      if (query.utm_term) trackingParams.utmTerm = String(query.utm_term);
      if (query.fbclid) trackingParams.fbclid = String(query.fbclid);
      if (query.gclid) trackingParams.gclid = String(query.gclid);
      if (query.ref) trackingParams.ref = String(query.ref);

      // Armazenar parâmetros e gerar token
      const token = trackingStorage.store(trackingParams);

      // Obter username do bot
      const botInfo = await fetch(`https://api.telegram.org/bot${bot.telegramToken}/getMe`).then(r => r.json());
      const botUsername = botInfo.result?.username;

      if (!botUsername) {
        set.status = 500;
        return { error: "Erro ao obter informações do bot" };
      }

      // Redirecionar diretamente para o Telegram
      const telegramUrl = `https://t.me/${botUsername}?start=${token}`;
      console.log(`[Tracking] Redirecionando para: ${telegramUrl}`);
      
      // Elysia não tem set.redirect, usar headers e status manualmente
      set.headers["Location"] = telegramUrl;
      set.status = 302;
      set.headers["Content-Type"] = "text/html; charset=utf-8";
      return `<html><head><meta http-equiv="refresh" content="0; url=${telegramUrl}"></head><body><script>window.location.href="${telegramUrl}";</script><p>Redirecionando para <a href="${telegramUrl}">Telegram</a>...</p></body></html>`;
    } catch (error: any) {
      console.error("[Tracking] Erro ao redirecionar:", error);
      set.status = 500;
      return { error: error.message || "Erro ao redirecionar" };
    }
  });
