/**
 * Ações pendentes por usuário.
 *
 * Motivo de existir: quando o dono clica em "Conectar WhatsApp", o bot precisa
 * interpretar a *próxima* mensagem como o número, e não como texto comum. Sem
 * esse estado, o bot não sabe que aquele texto é uma resposta a uma pergunta.
 *
 * Fica em memória de propósito: uma ação pendente vale para a próxima mensagem.
 * Se o bot reiniciar no meio, o dono simplesmente clica de novo.
 */

export type PendingAction = 'whatsapp_number';

export class PendingActions {
  private readonly porUsuario = new Map<number, PendingAction>();

  set(userId: number, action: PendingAction): void {
    this.porUsuario.set(userId, action);
  }

  peek(userId: number): PendingAction | undefined {
    return this.porUsuario.get(userId);
  }

  /** Devolve a ação pendente e a consome: vale só para uma mensagem. */
  take(userId: number): PendingAction | undefined {
    const acao = this.porUsuario.get(userId);
    this.porUsuario.delete(userId);
    return acao;
  }

  clear(userId: number): void {
    this.porUsuario.delete(userId);
  }
}
