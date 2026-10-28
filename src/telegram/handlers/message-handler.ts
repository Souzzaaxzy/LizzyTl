/**
 * Resposta a mensagens que não são comandos nem callbacks.
 *
 * Motivo de existir: sem isso o bot fica mudo quando o usuário digita "oi" ou
 * uma foto, e a impressão é de bot quebrado. Aqui ele sempre responde algo
 * útil, apontando para o menu.
 *
 * Este handler é registrado por último de propósito: comandos e callbacks têm
 * prioridade, e só o que sobrar chega aqui.
 */

import type { Context, Telegraf } from 'telegraf';

import type { Logger } from '../../core/logger.js';
import type { UserStore } from '../../data/user-store.js';
import type { WhatsAppClient } from '../../whatsapp/client.js';
import { normalizeWhatsappNumber } from '../../whatsapp/client.js';
import { buildMenuKeyboard } from '../screens/screens.js';
import type { PendingActions } from '../state/pending-action.js';

export interface MessageHandlerDeps {
  logger: Logger;
  users: UserStore;
  whatsapp: WhatsAppClient;
  pendingActions: PendingActions;
}

const REPLY = [
  '✦ 𝐍𝐚̃𝐨 𝐞𝐧𝐭𝐞𝐧𝐝𝐢 𝐞𝐬𝐬𝐚 𝐦𝐞𝐧𝐬𝐚𝐠𝐞𝐦.',
  '',
  '♛ 𝐔𝐬𝐞 /start 𝐩𝐚𝐫𝐚 𝐚𝐛𝐫𝐢𝐫 𝐨 𝐦𝐞𝐧𝐮 𝐩𝐫𝐢𝐧𝐜𝐢𝐩𝐚𝐥.',
  '✦ 𝐔𝐬𝐞 /help 𝐩𝐚𝐫𝐚 𝐯𝐞𝐫 𝐨𝐬 𝐜𝐨𝐦𝐚𝐧𝐝𝐨𝐬 𝐝𝐢𝐬𝐩𝐨𝐧í𝐯𝐞𝐢𝐬.',
].join('\n');

export function registerMessageHandler(bot: Telegraf, deps: MessageHandlerDeps): void {
  const logger = deps.logger.child('messages');

  /**
   * Interpreta a mensagem como o número do WhatsApp, quando o dono acabou de
   * tocar em "Conectar WhatsApp".
   *
   * Devolve true quando tratou a mensagem, para ela não cair na resposta
   * genérica logo abaixo.
   */
  const tratarNumeroPendente = async (ctx: Context): Promise<boolean> => {
    const userId = ctx.from?.id;
    if (userId === undefined || !deps.users.isOwner(userId)) {
      return false;
    }
    if (deps.pendingActions.peek(userId) !== 'whatsapp_number') {
      return false;
    }

    // Consome a ação: vale só para esta mensagem.
    deps.pendingActions.take(userId);
    const texto = ctx.message && 'text' in ctx.message ? ctx.message.text : undefined;
    const numero = normalizeWhatsappNumber(texto ?? '');

    if (numero.length < 10) {
      await ctx
        .reply(
          [
            '✦ 𝐍𝐮́𝐦𝐞𝐫𝐨 𝐢𝐧𝐯𝐚́𝐥𝐢𝐝𝐨.',
            '',
            '♛ 𝐄𝐧𝐯𝐢𝐞 𝐜𝐨𝐦 𝐜𝐨́𝐝𝐢𝐠𝐨 𝐝𝐨 𝐩𝐚𝐢́𝐬 𝐞 𝐬𝐨́ 𝐝𝐢́𝐠𝐢𝐭𝐨𝐬. 𝐄𝐱.: 5511999999999',
          ].join('\n'),
          { parse_mode: 'HTML' },
        )
        .catch(() => undefined);
      // Mantém a pendência para o dono poder corrigir sem clicar de novo.
      deps.pendingActions.set(userId, 'whatsapp_number');
      return true;
    }

    await ctx
      .reply('✦ 𝐍𝐮́𝐦𝐞𝐫𝐨 𝐫𝐞𝐜𝐞𝐛𝐢𝐝𝐨. 𝐆𝐞𝐫𝐚𝐧𝐝𝐨 𝐨 𝐜𝐨́𝐝𝐢𝐠𝐨 𝐝𝐞 𝐩𝐚𝐫𝐞𝐚𝐦𝐞𝐧𝐭𝐨...', {
        parse_mode: 'HTML',
      })
      .catch(() => undefined);

    // Não espera: o código chega pelo callback, assim que o WhatsApp responder.
    void deps.whatsapp.connectNumber(numero).catch((error: unknown) => {
      logger.error('Falha ao conectar o WhatsApp com o número informado.', error);
    });
    return true;
  };

  bot.on('message', async (ctx) => {
    if (await tratarNumeroPendente(ctx)) {
      return;
    }

    try {
      await ctx.reply(REPLY, {
        parse_mode: 'HTML',
        reply_markup: buildMenuKeyboard(),
      });
    } catch (error) {
      logger.error('Falha ao responder mensagem comum.', error);
    }
  });
}
