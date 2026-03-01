interface PixResponse {
  id: string;
  pixCode: string;
  qrCode?: string;
  expiresAt?: Date;
}

export class SyncPayService {
  private apiKey: string;
  private apiSecret: string;
  private apiUrl: string;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(apiKey: string, apiSecret: string) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    // Verificar se a URL está configurada, caso contrário usar a padrão
    this.apiUrl = process.env.SYNCPAY_API_URL || "https://api.syncpay.com.br";
  }

  // Gerar token de autenticação
  private async getAccessToken(): Promise<string | null> {
    try {
      // Se o token ainda é válido, retornar o existente
      if (this.accessToken && Date.now() < this.tokenExpiresAt) {
        return this.accessToken;
      }

      const endpoint = `${this.apiUrl}/api/partner/v1/auth-token`;
      
      
      // Criar um AbortController para timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos de timeout
      
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify({
            client_id: this.apiKey,
            client_secret: this.apiSecret,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Erro ao gerar token SyncPay:", {
            status: response.status,
            statusText: response.statusText,
            error: errorText.substring(0, 500),
            endpoint,
          });
          return null;
        }

        const data = await response.json();

        // Armazenar token e tempo de expiração
        this.accessToken = data.access_token;
        
        // Usar expires_in ou calcular a partir de expires_at
        if (data.expires_at) {
          const expiresAtDate = new Date(data.expires_at);
          this.tokenExpiresAt = expiresAtDate.getTime() - 60000; // 1 minuto de margem
        } else {
          const expiresIn = data.expires_in || 3600; // Padrão 1 hora
          this.tokenExpiresAt = Date.now() + (expiresIn * 1000) - 60000; // 1 minuto de margem
        }

        return this.accessToken;
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          console.error("Erro ao gerar token SyncPay: Timeout ao conectar", {
            endpoint,
            apiUrl: this.apiUrl,
          });
        } else {
          console.error("Erro ao gerar token SyncPay:", {
            error: fetchError.message,
            code: fetchError.code,
            endpoint,
            apiUrl: this.apiUrl,
            stack: fetchError.stack?.substring(0, 500),
          });
        }
        return null;
      }
    } catch (error: any) {
      console.error("Erro ao gerar token SyncPay:", {
        error: error.message,
        code: error.code,
        endpoint: `${this.apiUrl}/api/partner/v1/auth-token`,
        apiUrl: this.apiUrl,
      });
      return null;
    }
  }

  async createPix(
    amountInCents: number,
    options?: {
      description?: string;
      clientName?: string;
      clientCpf?: string;
      clientEmail?: string;
      clientPhone?: string;
      webhookUrl?: string;
      externalReference?: string; // ID do pagamento no nosso sistema
    }
  ): Promise<PixResponse | null> {
    try {
      // Obter token de autenticação
      const token = await this.getAccessToken();
      if (!token) {
        console.error("Não foi possível obter token de autenticação");
        return null;
      }

      // Converter centavos para reais
      const amountInReais = amountInCents / 100;

      // Preparar body conforme formato da API SyncPay
      const body: any = {
        amount: amountInReais,
        description: options?.description || "Pagamento via Telegram Bot",
      };

      // Adicionar webhook_url se configurado
      const webhookUrl = options?.webhookUrl || process.env.WEBHOOK_URL;
      if (webhookUrl) {
        body.webhook_url = webhookUrl;
      }

      // Adicionar external_reference se fornecido (ID do pagamento no nosso sistema)
      if (options?.externalReference) {
        body.external_reference = options.externalReference;
      }

      // Adicionar dados do cliente se fornecidos
      if (options?.clientName || options?.clientCpf || options?.clientEmail || options?.clientPhone) {
        body.client = {};
        if (options.clientName) body.client.name = options.clientName;
        // CPF deve ser apenas números (sem pontos ou traços)
        if (options.clientCpf) {
          body.client.cpf = options.clientCpf.replace(/\D/g, '');
        }
        if (options.clientEmail) body.client.email = options.clientEmail;
        // Telefone deve ser apenas números (sem formatação)
        if (options.clientPhone) {
          body.client.phone = options.clientPhone.replace(/\D/g, '');
        }
      }

      const endpoint = `${this.apiUrl}/api/partner/v1/cash-in`;


      // Criar um AbortController para timeout na criação de PIX
      const pixController = new AbortController();
      const pixTimeoutId = setTimeout(() => pixController.abort(), 30000); // 30 segundos

      let response;
      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: pixController.signal,
        });
        clearTimeout(pixTimeoutId);
      } catch (fetchError: any) {
        clearTimeout(pixTimeoutId);
        if (fetchError.name === 'AbortError') {
          console.error("Erro ao criar PIX no SyncPay: Timeout ao conectar", {
            endpoint,
            apiUrl: this.apiUrl,
          });
        } else {
          console.error("Erro ao criar PIX no SyncPay:", {
            error: fetchError.message,
            endpoint,
            apiUrl: this.apiUrl,
          });
        }
        return null;
      }

      if (!response.ok) {
        let errorText = '';
        try {
          errorText = await response.text();
        } catch (e) {
          errorText = 'Erro ao ler resposta';
        }
        
        console.error(`Erro ao criar PIX no SyncPay:`, {
          status: response.status,
          statusText: response.statusText,
          error: errorText.substring(0, 500),
          endpoint,
          body: JSON.stringify(body),
        });
        return null;
      }

      const data = await response.json();


      // Validar resposta conforme formato da API
      if (!data.identifier || !data.pix_code) {
        console.error("Resposta inválida do SyncPay:", data);
        return null;
      }

      // Mapear resposta do SyncPay para nosso formato
      // A API retorna: { message, pix_code, identifier }
      return {
        id: data.identifier, // Usar identifier como ID
        pixCode: data.pix_code,
        qrCode: data.qr_code_image || data.qrCodeImage || data.qr_code || undefined,
        expiresAt: data.expires_at || data.expiresAt
          ? new Date(data.expires_at || data.expiresAt)
          : new Date(Date.now() + 30 * 60 * 1000), // 30 minutos padrão
      };
    } catch (error: any) {
      console.error("Erro ao criar PIX no SyncPay:", {
        error: error.message,
        stack: error.stack?.substring(0, 500),
      });
      return null;
    }
  }

  async checkPayment(paymentId: string): Promise<"pending" | "paid" | "expired" | "cancelled"> {
    try {
      // Obter token de autenticação
      const token = await this.getAccessToken();
      if (!token) {
        return "pending";
      }

      // Tentar diferentes endpoints possíveis para verificar pagamento
      // Baseado no padrão da API: /api/partner/v1/cash-in
      const endpoints = [
        `${this.apiUrl}/api/partner/v1/cash-in/${paymentId}`,
        `${this.apiUrl}/api/partner/v1/cash-in/${paymentId}/status`,
        `${this.apiUrl}/api/partner/v1/pix/${paymentId}`,
        `${this.apiUrl}/api/pix/${paymentId}`,
        `${this.apiUrl}/api/pix/status/${paymentId}`,
        `${this.apiUrl}/api/v1/pix/${paymentId}`,
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            method: "GET",
            headers: {
              "Accept": "application/json",
              "Authorization": `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();

            // Verificar diferentes formatos de status
            const status = data.status || data.payment_status || data.state || data.situation;
            
            if (status === "paid" || status === "pago" || status === "approved" || data.paid === true) {
              return "paid";
            }

            if (status === "expired" || status === "expirado" || status === "expired" || data.expired === true) {
              return "expired";
            }

            if (status === "cancelled" || status === "cancelado" || status === "canceled" || data.cancelled === true) {
              return "cancelled";
            }

            // Se chegou aqui, ainda está pendente
            return "pending";
          }
        } catch (fetchError) {
          // Continuar para o próximo endpoint
          continue;
        }
      }

      // Se nenhum endpoint funcionou, assumir como pendente
      return "pending";
    } catch (error) {
      console.error("Erro ao verificar pagamento no SyncPay:", error);
      return "pending";
    }
  }
}
