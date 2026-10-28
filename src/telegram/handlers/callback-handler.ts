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
import {
  screenContext,
  screenForCallback,
  type Screen,
  type ScreenContext,
} from '../screens/screens';

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
 * Detecta o erro do Telegram para edição sem mudança de conteúdo.
 *
 * Sem isso, repetir o mesmo clique enviaria uma mensagem nova e o menu
 * apareceria duplicado no chat.
 */
export function isNotModified(error: unknown): boolean {
  const descricao =
    typeof error === 'object' && error !== null && 'description' in error
      ? String((error as { description?: unknown }).description ?? '')
      : '';
  return descricao.includes('message is not modified');
}

/**
 * Monta o contexto de uma tela. O bloco `admin` só é preenchido para o dono,
 * e a decisão vem do `UserStore` (servidor), nunca do payload do callback.
 */
function contextFor(ctx: Context, deps: CallbackHandlerDeps): ScreenContext {
  const userId = ctx.from?.id;
  const user = userId !== undefined ? deps.users.get(userId) ?? null : null;
  const base = screenContext(user, ctx.from);

  if (!deps.users.isOwner(userId)) {
    return base;
  }

  return {
    ...base,
    admin: {
      stats: deps.users.stats(),
      recentUsers: deps.users.recent(10),
      totalUsers: deps.users.count(),
    },
  };
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
  const context = contextFor(ctx, deps);
  const caption = screen.buildCaption(context);
  const keyboard = screen.buildKeyboard(context);

  try {
    await ctx.editMessageCaption(caption, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (error) {
    // Clicar no mesmo botão duas vezes faz o Telegram recusar a edição com
    // "message is not modified". Isso não é falha: a tela já está correta.
    // Tratar como erro enviaria uma mensagem nova e duplicaria o menu no chat.
    if (isNotModified(error)) {
      return;
    }
    deps.logger.debug('Edição da legenda falhou; enviando uma mensagem nova.', error);
    await ctx.reply(caption, { parse_mode: 'HTML', reply_markup: keyboard });
  }
}

export function registerCallbackHandler(bot: Telegraf, deps: CallbackHandlerDeps): void {
  const logger = deps.logger.child('callbacks');

  // Prefixos conhecidos. Um prefixo novo precisa ser adicionado aqui, senão o
  // callback cai no fallback e a tela nunca abre.
  bot.action(/^(menu|nav|admin)_/, async (ctx) => {
    const callbackData = extractCallbackData(ctx.callbackQuery);
    const screen = screenForCallback(callbackData);

    if (screen === undefined) {
      logger.warn(`Callback desconhecido recebido: "${callbackData}"`);
      await ctx.answerCbQuery('Opção indisponível no momento.');
      return;
    }

    // Autorização no servidor: esconder o botão não protege nada, porque
    // qualquer pessoa pode enviar um callback forjado com o mesmo data.
    if (screen.ownerOnly && !deps.users.isOwner(ctx.from?.id)) {
      logger.warn(
        `Tentativa de abrir tela restrita "${screen.id}" pelo usuário ${ctx.from?.id ?? 'desconhecido'}.`,
      );
      await ctx.answerCbQuery('Acesso restrito.');
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
