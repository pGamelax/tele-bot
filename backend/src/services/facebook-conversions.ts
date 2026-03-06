/**
 * Serviço para enviar eventos para Facebook Conversions API
 * Documentação: https://developers.facebook.com/docs/marketing-api/conversions-api
 */

import { createHash } from "crypto";

/**
 * Faz hash SHA256 de uma string (requerido pelo Facebook)
 */
function hashSHA256(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
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
  private apiUrl = "https://graph.facebook.com/v18.0";

  /**
   * Envia evento de compra para Facebook Conversions API
   */
  async sendPurchaseEvent(data: PurchaseEventData): Promise<boolean> {
    try {
      if (!data.pixelId || !data.accessToken) {
        console.warn("[Facebook Conversions] Pixel ID ou Access Token não configurado");
        return false;
      }

      const endpoint = `${this.apiUrl}/${data.pixelId}/events`;

      // Preparar user_data com dados do cliente (Facebook requer pelo menos um)
      const userData: any = {};
      
      // Adicionar fbc (Facebook Click ID)
      if (data.userData.fbclid) {
        userData.fbc = `fb.1.${data.userData.fbclid}.${Date.now()}`;
      }
      
      // Adicionar IP e User Agent
      if (data.userData.client_ip_address) {
        userData.client_ip_address = data.userData.client_ip_address;
      }
      if (data.userData.client_user_agent) {
        userData.client_user_agent = data.userData.client_user_agent;
      }
      
      // Adicionar dados do cliente (hash SHA256 conforme requerido pelo Facebook)
      if (data.userData.email) {
        userData.em = hashSHA256(data.userData.email);
      }
      if (data.userData.phone) {
        userData.ph = hashSHA256(data.userData.phone);
      }
      if (data.userData.firstName) {
        userData.fn = hashSHA256(data.userData.firstName);
      }
      if (data.userData.lastName) {
        userData.ln = hashSHA256(data.userData.lastName);
      }
      if (data.userData.externalId) {
        userData.external_id = data.userData.externalId;
      }

      // Preparar payload conforme especificação da API
      const payload = {
        data: [
          {
            event_name: data.eventName,
            event_time: data.eventTime,
            event_source_url: data.eventSourceUrl || process.env.FACEBOOK_EVENT_SOURCE_URL || "https://telegram.org",
            action_source: data.actionSource || "other",
            user_data: userData,
            custom_data: {
              value: data.customData.value,
              currency: data.customData.currency,
              ...(data.customData.content_ids && { content_ids: data.customData.content_ids }),
              ...(data.customData.content_name && { content_name: data.customData.content_name }),
              ...(data.customData.content_type && { content_type: data.customData.content_type }),
            },
          },
        ],
        access_token: data.accessToken,
      };


      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Facebook Conversions] Erro ao enviar evento:`, {
          status: response.status,
          statusText: response.statusText,
          error: errorText.substring(0, 500),
        });
        return false;
      }

      const result = await response.json();
      
      if (result.events_received && result.events_received > 0) {
        return true;
      } else {
        console.warn(`[Facebook Conversions] Evento não foi recebido:`, result);
        return false;
      }
    } catch (error: any) {
      console.error("[Facebook Conversions] Erro ao enviar evento:", {
        error: error.message,
        stack: error.stack?.substring(0, 300),
      });
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
      actionSource: "other",
    });
  }
}
