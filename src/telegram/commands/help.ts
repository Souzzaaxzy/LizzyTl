/**
 * Comando /help da 𝐋𝐢𝐳𝐳𝐲 𝐝𝐨 𝐩𝐫𝐢𝐯𝐲.
 *
 * A lista de comandos vem de BOT_COMMANDS, a mesma fonte usada pelo
 * setMyCommands, para a ajuda nunca divergir do que está publicado.
 */

import type { Telegraf } from 'telegraf';

import type { Logger } from '../../core/logger.js';
import { buildHelpCaption, buildMenuKeyboard } from '../screens/screens.js';

export interface HelpCommandDeps {
  logger: Logger;
}

export function registerHelpCommand(bot: Telegraf, deps: HelpCommandDeps): void {
  const logger = deps.logger.child('help');

  bot.help(async (ctx) => {
    try {
      await ctx.reply(buildHelpCaption(), {
        parse_mode: 'HTML',
        reply_markup: buildMenuKeyboard(),
      });
    } catch (error) {
      logger.error('Falha ao responder /help.', error);
      // Resposta mínima para o usuário não ficar sem retorno.
      await ctx.reply('Use /start para abrir o menu principal.');
    }
  });
}
