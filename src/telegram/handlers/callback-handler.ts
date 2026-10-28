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

import type { Logger } from '../../core/logger.js';
import type { UserStore } from '../../data/user-store.js';
import type { PendingActions } from '../state/pending-action.js';
import type { WhatsAppManager } from '../../whatsapp/manager.js';
import {
  CALLBACKS,
  screenContext,
  screenForCallback,
  type Screen,
  type ScreenContext,
} from '../screens/screens.js';

export interface CallbackHandlerDeps {
  logger: Logger;
  users: UserStore;
  /** Estado real do WhatsApp do usuário que está navegando. */
  whatsapp?: Pick<WhatsAppManager, 'getStatus'>;
  /** Ações que mudam o estado da sessão do usuário (conectar/desconectar). */
  whatsappFull?: Pick<WhatsAppManager, 'desconectar'>;
  /** Ações que esperam a próxima mensagem do usuário. */
  pendingActions?: PendingActions;
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
  const base = {
    ...screenContext(user, ctx.from),
    // Estado do WhatsApp DE QUEM ESTÁ NAVEGANDO, nunca de outro usuário.
    // Tolerante a ausência: uma tela não pode derrubar a atualização inteira.
    whatsapp: userId !== undefined ? deps.whatsapp?.getStatus(userId) : undefined,
  };

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

/**
 * Pede o número ao usuário. A próxima mensagem dele é interpretada como
 * número, não como texto comum — é para isso que serve a ação pendente.
 *
 * Qualquer usuário pode conectar o próprio número: o bot é público. O que
 * importa é que a sessão criada pertença a quem pediu.
 */
async function handleWhatsappConnect(
  ctx: Context,
  deps: CallbackHandlerDeps,
): Promise<void> {
  const userId = ctx.from?.id;
  if (userId === undefined) {
    await ctx.answerCbQuery();
    return;
  }

  await ctx.answerCbQuery();
  deps.pendingActions?.set(userId, 'whatsapp_number');
  await ctx
    .reply(
      [
        '📱 𝐂𝐨𝐧𝐞𝐜𝐭𝐚𝐫 𝐖𝐡𝐚𝐭𝐬𝐀𝐩𝐩',
        '',
        '♛ 𝐄𝐧𝐯𝐢𝐞 𝐨 𝐧𝐮́𝐦𝐞𝐫𝐨 𝐝𝐨 𝐖𝐡𝐚𝐭𝐬𝐀𝐩𝐩 𝐪𝐮𝐞 𝐯𝐚𝐢 𝐫𝐨𝐝𝐚𝐫 𝐚 𝐋𝐢𝐳𝐳𝐲.',
        '',
        '✦ 𝐂𝐨𝐦 𝐜𝐨́𝐝𝐢𝐠𝐨 𝐝𝐨 𝐩𝐚𝐢́𝐬 𝐞 𝐬𝐨́ 𝐝𝐢́𝐠𝐢𝐭𝐨𝐬. 𝐄𝐱.: 5511999999999',
        '',
        '♛ 𝐎 𝐜𝐨́𝐝𝐢𝐠𝐨 𝐝𝐞 𝐩𝐚𝐫𝐞𝐚𝐦𝐞𝐧𝐭𝐨 𝐜𝐡𝐞𝐠𝐚 𝐚𝐪𝐮𝐢 𝐧𝐞𝐬𝐭𝐞 𝐜𝐡𝐚𝐭.',
      ].join('\n'),
      { parse_mode: 'HTML' },
    )
    .catch(() => undefined);
}

/**
 * Desconecta a sessão de quem pediu, apagando as credenciais dele.
 *
 * Só afeta a própria sessão: a de outro usuário nunca é tocada.
 */
async function handleWhatsappDisconnect(
  ctx: Context,
  deps: CallbackHandlerDeps,
): Promise<void> {
  const userId = ctx.from?.id;
  if (userId === undefined) {
    await ctx.answerCbQuery();
    return;
  }

  deps.pendingActions?.clear(userId);
  deps.whatsappFull?.desconectar(userId);
  await ctx.answerCbQuery('WhatsApp desconectado.');
  await renderScreen(ctx, screenForCallback(CALLBACKS.MENU_WHATSAPP)!, deps);
}

export function registerCallbackHandler(bot: Telegraf, deps: CallbackHandlerDeps): void {
  const logger = deps.logger.child('callbacks');

  // Prefixos conhecidos. Derivado de CALLBACKS para não haver dois lugares
  // onde esquecer de registrar um prefixo novo (isso já causou bug duas vezes).
  const prefixos = [...new Set(Object.values(CALLBACKS).map((c) => c.split('_')[0]))].join('|');
  bot.action(new RegExp(`^(${prefixos})_`), async (ctx) => {
    const callbackData = extractCallbackData(ctx.callbackQuery);

    // Ações primeiro: elas não são navegação e não têm tela correspondente,
    // então precisam ser tratadas antes da checagem de tela.
    if (callbackData === CALLBACKS.WA_CONNECT) {
      await handleWhatsappConnect(ctx, deps);
      return;
    }
    if (callbackData === CALLBACKS.WA_DISCONNECT) {
      await handleWhatsappDisconnect(ctx, deps);
      return;
    }

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
