/**
 * Navegação por callbacks.
 *
 * Toda tela é renderizada editando a mensagem atual, não enviando uma nova.
 * Assim a mídia continua rodando no balão e o chat não enche de mensagens.
 *
 * Regras atendidas:
 * - Todo callback recebe answerCbQuery, evitando o "carregando" permanente.
 * - Identificadores são validados; callbacks desconhecidos não derrubam o bot.
 * - A estrutura permite adicionar telas sem reescrever a navegação.
 */

import type { Context, Telegraf } from 'telegraf';

import type { Logger } from '../../core/logger';
import type { UserStore } from '../../data/user-store';
import { screenForCallback, type Screen } from '../screens/screens';

export interface CallbackHandlerDeps {
  logger: Logger;
  users: UserStore;
}

/**
 * O tipo CallbackQuery é uma união que inclui GameQuery, que não possui "data".
 * Este helper extrai o dado com segurança, devolvendo string vazia quando ausente.
 */
export function extractCallbackData(query: unknown): string {
  if (typeof query === 'object' && query !== null && 'data' in query) {
    const data = (query as { data?: unknown }).data;
    if (typeof data === 'string') {
      return data;
    }
  }
  return '';
}

/**
 * Renderiza a tela editando a mensagem que contém os botões.
 *
 * Quando a edição falha (por exemplo, a mensagem é antiga demais e o Telegram
 * recusa), envia uma mensagem nova em vez de deixar o usuário sem resposta.
 */
async function renderScreen(
  ctx: Context,
  screen: Screen,
  deps: CallbackHandlerDeps,
): Promise<void> {
  const userId = ctx.from?.id;
  const user = userId !== undefined ? deps.users.get(userId) ?? null : null;
  const caption = screen.buildCaption(user);
  const keyboard = screen.buildKeyboard();

  try {
    await ctx.editMessageCaption(caption, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (error) {
    deps.logger.debug('Edição da legenda falhou; enviando uma mensagem nova.', error);
    await ctx.reply(caption, { parse_mode: 'HTML', reply_markup: keyboard });
  }
}

export function registerCallbackHandler(bot: Telegraf, deps: CallbackHandlerDeps): void {
  const logger = deps.logger.child('callbacks');

  bot.action(/^menu_|^nav_/, async (ctx) => {
    const callbackData = extractCallbackData(ctx.callbackQuery);
    const screen = screenForCallback(callbackData);

    if (screen === undefined) {
      logger.warn(`Callback desconhecido recebido: "${callbackData}"`);
      await ctx.answerCbQuery('Opção indisponível no momento.');
      return;
    }

    await ctx.answerCbQuery();
    await renderScreen(ctx, screen, deps);
  });

  // Qualquer outro callback (fora dos prefixos conhecidos) também é respondido.
  bot.on('callback_query', async (ctx) => {
    const callbackData = extractCallbackData(ctx.callbackQuery);
    logger.warn(`Callback fora das telas conhecidas: "${callbackData}"`);
    await ctx.answerCbQuery('Ação não reconhecida.');
  });
}
