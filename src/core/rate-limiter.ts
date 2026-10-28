/**
 * Limitador de taxa por usuário.
 *
 * Motivo de existir: sem limite, alguém (ou um script) pode martelar o bot e
 * inflar o `data/users.json` com requisições. O limitador segura isso antes de
 * qualquer trabalho caro (ler o arquivo, subir mídia, escrever em disco).
 *
 * A janela é deslizante e mantida em memória: não precisa de persistência,
 * porque reiniciar o bot já zera o abuso e o custo de guardar em disco não se
 * paga. O mapa é limpo periodicamente para não crescer sem limite.
 */

export interface RateLimiterOptions {
  /** Máximo de ações permitidas dentro da janela. */
  limit: number;
  /** Tamanho da janela em milissegundos. */
  windowMs: number;
  /** Relógio injetável, para testar sem esperar tempo real. */
  now?: () => number;
}

export interface RateLimitResult {
  /** Verdadeiro quando a ação é permitida. */
  allowed: boolean;
  /** Segundos restantes até poder tentar de novo (arredondado para cima). */
  retryAfterSeconds: number;
}

export class RateLimiter {
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly now: () => number;
  /** Instantes das ações recentes, por usuário. */
  private readonly hits = new Map<number, number[]>();

  constructor(options: RateLimiterOptions) {
    this.limit = options.limit;
    this.windowMs = options.windowMs;
    this.now = options.now ?? (() => Date.now());
  }

  /**
   * Registra uma tentativa e diz se ela é permitida.
   *
   * A verificação é somente leitura quando bloqueia (não conta a tentativa
   * negada), para que insistir não estenda o castigo indefinidamente.
   */
  check(userId: number): RateLimitResult {
    const agora = this.now();
    const recentes = (this.hits.get(userId) ?? []).filter((t) => agora - t < this.windowMs);

    if (recentes.length >= this.limit) {
      const maisAntiga = recentes[0] ?? agora;
      const espera = Math.ceil((this.windowMs - (agora - maisAntiga)) / 1000);
      this.hits.set(userId, recentes);
      return { allowed: false, retryAfterSeconds: Math.max(1, espera) };
    }

    recentes.push(agora);
    this.hits.set(userId, recentes);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  /** Remove registros antigos de todos os usuários. */
  prune(): void {
    const agora = this.now();
    for (const [userId, marcas] of this.hits) {
      const recentes = marcas.filter((t) => agora - t < this.windowMs);
      if (recentes.length === 0) {
        this.hits.delete(userId);
      } else {
        this.hits.set(userId, recentes);
      }
    }
  }

  /** Quantidade de usuários com registros na memória. */
  size(): number {
    return this.hits.size;
  }
}
