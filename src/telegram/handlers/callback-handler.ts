/**
 * Handler dos callbacks dos botões inline.
 *
 * Regras atendidas:
 * - Todo callback recebe answerCbQuery, evitando o "carregando" permanente.
 * - Identificadores são validados; callbacks desconhecidos não derrubam o bot.
 * - A estrutura permite adicionar submenus sem reescrever o handler.
 */

import type { Telegraf } from 'telegraf';

import type { Logger } from '../../core/logger';
import { getMenuResponse } from '../menus/main-menu';

export interface CallbackHandlerDeps {
  logger: Logger;
}

/**
 * O tipo CallbackQuery é uma união que inclui GameQuery, que não possui "data".
 * Este helper extrai o dado com segurança, devolvendo string vazia quando ausente.
 */
function extractCallbackData(query: unknown): string {
  if (typeof query === 'object' && query !== null && 'data' in query) {
    const data = (query as { data?: unknown }).data;
    if (typeof data === 'string') {
      return data;
    }
  }
  return '';
}

export function registerCallbackHandler(bot: Telegraf, deps: CallbackHandlerDeps): void {
  const logger = deps.logger.child('callbacks');

  // Filtro por prefixo: qualquer botão de menu futuro pode usar "menu_".
  bot.action(/^menu_/, async (ctx) => {
    const callbackData = extractCallbackData(ctx.callbackQuery);
    const response = getMenuResponse(callbackData);

    if (response === undefined) {
      logger.warn(`Callback desconhecido recebido: "${callbackData}"`);
      await ctx.answerCbQuery('Opção indisponível no momento.');
      return;
    }

    await ctx.answerCbQuery();
    await ctx.reply(response, { parse_mode: 'HTML' });
  });

  // Qualquer outro callback (fora do prefixo "menu_") também é respondido.
  bot.on('callback_query', async (ctx) => {
    const callbackData = extractCallbackData(ctx.callbackQuery);
    logger.warn(`Callback fora do menu principal: "${callbackData}"`);
    await ctx.answerCbQuery('Ação não reconhecida.');
  });
}
