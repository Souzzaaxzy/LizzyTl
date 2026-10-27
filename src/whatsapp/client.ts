/**
 * Estado real do módulo de WhatsApp da 𝐋𝐢𝐳𝐳𝐲 𝐝𝐨 𝐩𝐫𝐢𝐯𝐲.
 *
 * Este arquivo existe apenas como ponto de integração futura. Ele NÃO abre
 * conexão, NÃO gera QR Code e NÃO guarda sessão. A biblioteca/fork da Baileys
 * será escolhido pelo proprietário do projeto antes de qualquer implementação.
 *
 * Enquanto isso, a única informação que este módulo pode fornecer é o estado
 * honesto de "não implementado" — nunca "conectado".
 */

export type WhatsAppConnectionState = 'not_implemented';

export interface WhatsAppIntegrationStatus {
  state: WhatsAppConnectionState;
  /** Texto curto e verdadeiro sobre o estado atual, usado no menu. */
  summary: string;
  /** Motivo pelo qual a integração ainda não existe. */
  reason: string;
}

const STATUS: WhatsAppIntegrationStatus = {
  state: 'not_implemented',
  summary: 'Módulo em preparação. Nenhuma conexão com o WhatsApp foi estabelecida até o momento.',
  reason:
    'O fork da Baileys ainda não foi definido pelo proprietário do projeto, então nenhuma implementação foi adicionada.',
};

export function getWhatsAppIntegrationStatus(): WhatsAppIntegrationStatus {
  return STATUS;
}

/** Verdadeiro somente quando existir conexão real e validada. Sempre falso agora. */
export function isWhatsAppConnected(): boolean {
  return false;
}
