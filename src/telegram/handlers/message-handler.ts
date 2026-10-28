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

import type { Telegraf } from 'telegraf';

import type { Logger } from '../../core/logger.js';
import { buildMenuKeyboard } from '../screens/screens.js';

export interface MessageHandlerDeps {
  logger: Logger;
}

const REPLY = [
  '✦ 𝐍𝐚̃𝐨 𝐞𝐧𝐭𝐞𝐧𝐝𝐢 𝐞𝐬𝐬𝐚 𝐦𝐞𝐧𝐬𝐚𝐠𝐞𝐦.',
  '',
  '♛ 𝐔𝐬𝐞 /start 𝐩𝐚𝐫𝐚 𝐚𝐛𝐫𝐢𝐫 𝐨 𝐦𝐞𝐧𝐮 𝐩𝐫𝐢𝐧𝐜𝐢𝐩𝐚𝐥.',
  '✦ 𝐔𝐬𝐞 /help 𝐩𝐚𝐫𝐚 𝐯𝐞𝐫 𝐨𝐬 𝐜𝐨𝐦𝐚𝐧𝐝𝐨𝐬 𝐝𝐢𝐬𝐩𝐨𝐧í𝐯𝐞𝐢𝐬.',
].join('\n');

export function registerMessageHandler(bot: Telegraf, deps: MessageHandlerDeps): void {
  const logger = deps.logger.child('messages');

  bot.on('message', async (ctx) => {
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
