/**
 * Serviço para armazenar temporariamente parâmetros de tracking
 * Os dados são armazenados em memória com TTL de 1 hora
 */

interface TrackingParams {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  fbclid?: string;
  gclid?: string;
  ref?: string;
  expiresAt: number; // Timestamp em milissegundos
}

export class TrackingStorage {
  private static instance: TrackingStorage;
  private storage: Map<string, TrackingParams> = new Map();
  private readonly TTL = 60 * 60 * 1000; // 1 hora em milissegundos

  private constructor() {
    // Limpar dados expirados a cada 5 minutos
    setInterval(() => {
      this.cleanExpired();
    }, 5 * 60 * 1000);
  }

  public static getInstance(): TrackingStorage {
    if (!TrackingStorage.instance) {
      TrackingStorage.instance = new TrackingStorage();
    }
    return TrackingStorage.instance;
  }

  /**
   * Armazena parâmetros de tracking e retorna um token único
   */
  public store(params: Omit<TrackingParams, "expiresAt">): string {
    const token = this.generateToken();
    const expiresAt = Date.now() + this.TTL;

    this.storage.set(token, {
      ...params,
      expiresAt,
    });

    console.log(`[TrackingStorage] Parâmetros armazenados para token: ${token}`);
    return token;
  }

  /**
   * Recupera parâmetros de tracking pelo token
   */
  public retrieve(token: string): Omit<TrackingParams, "expiresAt"> | null {
    const data = this.storage.get(token);

    if (!data) {
      console.log(`[TrackingStorage] Token não encontrado: ${token}`);
      return null;
    }

    if (Date.now() > data.expiresAt) {
      console.log(`[TrackingStorage] Token expirado: ${token}`);
      this.storage.delete(token);
      return null;
    }

    // Remover token após uso (one-time use)
    this.storage.delete(token);

    const { expiresAt, ...params } = data;
    console.log(`[TrackingStorage] Parâmetros recuperados para token: ${token}`, params);
    return params;
  }

  /**
   * Gera um token único
   */
  private generateToken(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Remove dados expirados
   */
  private cleanExpired(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [token, data] of this.storage.entries()) {
      if (now > data.expiresAt) {
        this.storage.delete(token);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[TrackingStorage] Limpeza: ${cleaned} tokens expirados removidos`);
    }
  }

  /**
   * Retorna o número de tokens ativos (para debug)
   */
  public getActiveCount(): number {
    return this.storage.size;
  }
}
