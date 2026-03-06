/**
 * Serviço para enviar eventos para Facebook Conversions API
 * Documentação: https://developers.facebook.com/docs/marketing-api/conversions-api
 */

import axios from "axios";
import crypto from "crypto";

/**
 * Faz hash SHA256 de uma string (requerido pelo Facebook)
 */
function hashSha256(dado: string): string {
  return crypto
    .createHash("sha256")
    .update(dado.trim().toLowerCase())
    .digest("hex");
}

interface PurchaseEventData {
  pixelId: string;
  accessToken: string;
  eventName: string; // "Purchase"
  eventTime: number; // Unix timestamp em segundos
  userData: {
    fbclid?: string;
    client_ip_address?: string;
    client_user_agent?: string;
    // Dados do cliente (devem ser hash SHA256, exceto external_id)
    email?: string; // Hash SHA256
    phone?: string; // Hash SHA256
    firstName?: string; // Hash SHA256
    lastName?: string; // Hash SHA256
    externalId?: string; // ID externo (não precisa hash)
  };
  customData: {
    value: number; // Valor em reais
    currency: string; // "BRL"
    content_ids?: string[]; // IDs dos produtos
    content_name?: string;
    content_type?: string;
  };
  eventSourceUrl?: string;
  actionSource?: string; // "website", "email", "app", "phone_call", "chat", "other"
}

export class FacebookConversionsService {
  /**
   * Envia evento de compra para Facebook Conversions API
   */
  async sendPurchaseEvent(data: PurchaseEventData): Promise<boolean> {
    try {
      if (!data.pixelId || !data.accessToken) {
        console.warn("[Facebook Conversions] Pixel ID ou Access Token não configurado");
        return false;
      }

      const url = `https://graph.facebook.com/v19.0/${data.pixelId}/events?access_token=${data.accessToken}`;

      // Preparar user_data com dados do cliente
      const userData: any = {};
      
      // Adicionar fbc (Facebook Click ID) - usar diretamente se fornecido
      if (data.userData.fbclid) {
        userData.fbc = data.userData.fbclid;
      }
      
      // Adicionar IP e User Agent
      if (data.userData.client_ip_address) {
        userData.client_ip_address = data.userData.client_ip_address;
      }
      if (data.userData.client_user_agent) {
        userData.client_user_agent = data.userData.client_user_agent;
      }
      
      // Adicionar dados do cliente (hash SHA256 conforme requerido pelo Facebook)
      // Usar arrays como no código que funcionou
      if (data.userData.firstName) {
        userData.fn = [hashSha256(data.userData.firstName)];
      }
      if (data.userData.lastName) {
        userData.ln = [hashSha256(data.userData.lastName)];
      }
      if (data.userData.email) {
        userData.em = [hashSha256(data.userData.email)];
      }
      if (data.userData.phone) {
        userData.ph = [hashSha256(data.userData.phone)];
      }
      if (data.userData.externalId) {
        userData.external_id = data.userData.externalId;
      }

      // Preparar payload conforme o código que funcionou
      const payload = {
        data: [
          {
            event_name: data.eventName,
            event_time: data.eventTime,
            action_source: data.actionSource || "chat",
            event_source_url: data.eventSourceUrl || "https://t.me/clashdata123bot",
            user_data: userData,
            custom_data: {
              currency: data.customData.currency,
              value: data.customData.value,
              ...(data.userData.externalId && { telegram_chat_id: data.userData.externalId }),
              ...(data.customData.content_ids && { content_ids: data.customData.content_ids }),
              ...(data.customData.content_name && { content_name: data.customData.content_name }),
              ...(data.customData.content_type && { content_type: data.customData.content_type }),
            },
          },
        ],
      };

      const res = await axios.post(url, payload, { family: 4 });
      console.log("✅ Compra enviada:", res.data);
      
      if (res.data.events_received && res.data.events_received > 0) {
        return true;
      } else {
        console.warn(`[Facebook Conversions] Evento não foi recebido:`, res.data);
        return false;
      }
    } catch (error: any) {
      console.error("❌ Erro ao enviar evento:", error.response?.data || error.message);
      console.log(error);
      return false;
    }
  }

  /**
   * Envia evento de compra simplificado (usa apenas dados básicos)
   */
  async sendPurchase(
    pixelId: string,
    accessToken: string,
    amount: number, // Valor em reais
    fbclid?: string,
    eventTime?: number,
    userData?: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      externalId?: string; // ID externo (ex: telegramChatId)
    }
  ): Promise<boolean> {
    return this.sendPurchaseEvent({
      pixelId,
      accessToken,
      eventName: "Purchase",
      eventTime: eventTime || Math.floor(Date.now() / 1000),
      userData: {
        fbclid,
        firstName: userData?.firstName,
        lastName: userData?.lastName,
        email: userData?.email,
        phone: userData?.phone,
        externalId: userData?.externalId,
      },
      customData: {
        value: amount,
        currency: "BRL",
        content_name: "Telegram Bot Purchase",
        content_type: "product",
      },
      actionSource: "chat",
    });
  }
}
