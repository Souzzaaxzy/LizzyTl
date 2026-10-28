/**
 * Mensagens que a 𝐋𝐢𝐳𝐳𝐲 envia sozinha, fora de comando.
 *
 * Motivo de existir: o usuário precisa saber o que aconteceu com a sessão de
 * WhatsApp dele sem precisar abrir a tela para conferir. Aqui ficam os textos,
 * separados do `index.ts`, para o ponto de entrada não virar depósito de
 * string.
 *
 * Formatação: trechos que o usuário deve copiar (código, ID) vão em `<code>`,
 * que no Telegram vira texto tocável — um toque copia.
 */

import type { WhatsAppState } from '../../whatsapp/client.js';

/** Escapa o que o Telegram interpretaria como HTML. */
function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Mensagem com o código de pareamento.
 *
 * O `<code>` é o que torna o código tocável: um toque copia, sem precisar
 * selecionar o texto no celular.
 */
export function buildPairingMessage(code: string): string {
  return [
    '📱 𝐂𝐨́𝐝𝐢𝐠𝐨 𝐝𝐞 𝐩𝐚𝐫𝐞𝐚𝐦𝐞𝐧𝐭𝐨 𝐝𝐨 𝐖𝐡𝐚𝐭𝐬𝐀𝐩𝐩',
    '',
    `♛ <code>${escapeHtml(code)}</code>`,
    '',
    '✦ 𝐍𝐨 𝐜𝐞𝐥𝐮𝐥𝐚𝐫: WhatsApp → Aparelhos conectados → Conectar aparelho →',
    '  Conectar com número de telefone.',
    '',
    '♛ 𝐓𝐨𝐪𝐮𝐞 𝐧𝐨 𝐜𝐨́𝐝𝐢𝐠𝐨 𝐚𝐜𝐢𝐦𝐚 𝐩𝐚𝐫𝐚 𝐜𝐨𝐩𝐢𝐚𝐫.',
    '✦ 𝐎 𝐜𝐨́𝐝𝐢𝐠𝐨 𝐞𝐱𝐩𝐢𝐫𝐚 𝐞𝐦 𝐜𝐞𝐫𝐜𝐚 𝐝𝐞 𝟏 𝐦𝐢𝐧𝐮𝐭𝐨.',
  ].join('\n');
}

/**
 * Mensagem de mudança de estado da sessão.
 *
 * Devolve null quando o estado não merece aviso no chat: "conectando" e
 * "aguardando pareamento" já têm mensagem própria, e avisar de novo só
 * poluiria a conversa.
 */
export function buildStateMessage(
  state: WhatsAppState,
  detalhe?: string,
): string | null {
  switch (state) {
    case 'conectado':
      return [
        '✅ 𝐖𝐡𝐚𝐭𝐬𝐀𝐩𝐩 𝐜𝐨𝐧𝐞𝐜𝐭𝐚𝐝𝐨!',
        '',
        detalhe ? `♛ 𝐍𝐮́𝐦𝐞𝐫𝐨: <code>${escapeHtml(detalhe)}</code>` : '',
        '✦ 𝐀 𝐋𝐢𝐳𝐳𝐲 𝐣𝐚́ 𝐞𝐬𝐭𝐚́ 𝐨𝐩𝐞𝐫𝐚𝐧𝐝𝐨 𝐧𝐞𝐬𝐭𝐞 𝐖𝐡𝐚𝐭𝐬𝐀𝐩𝐩.',
      ]
        .filter((linha) => linha !== '')
        .join('\n');

    case 'erro':
      return [
        '⚠️ 𝐏𝐫𝐨𝐛𝐥𝐞𝐦𝐚 𝐧𝐨 𝐖𝐡𝐚𝐭𝐬𝐀𝐩𝐩',
        '',
        `✦ ${escapeHtml(detalhe ?? 'A conexão falhou.')}`,
        '',
        '♛ 𝐀𝐛𝐫𝐚 📱 𝐖𝐡𝐚𝐭𝐬𝐀𝐩𝐩 𝐧𝐨 𝐦𝐞𝐧𝐮 𝐩𝐚𝐫𝐚 𝐯𝐞𝐫 𝐨 𝐞𝐬𝐭𝐚𝐝𝐨 𝐞 𝐫𝐞𝐜𝐨𝐧𝐞𝐜𝐭𝐚𝐫.',
      ].join('\n');

    case 'desligado':
      // Só avisa se havia algo conectado antes (detalhe marca isso).
      return detalhe
        ? ['🔌 𝐖𝐡𝐚𝐭𝐬𝐀𝐩𝐩 𝐝𝐞𝐬𝐜𝐨𝐧𝐞𝐜𝐭𝐚𝐝𝐨.', '', `✦ ${escapeHtml(detalhe)}`].join('\n')
        : null;

    // "conectando" e "aguardando pareamento" não geram aviso próprio.
    case 'conectando':
    case 'aguardando_pareamento':
    default:
      return null;
  }
}
