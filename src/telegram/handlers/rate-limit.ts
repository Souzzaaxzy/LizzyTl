/**
 * Middleware de limite de taxa.
 *
 * Registrado antes dos comandos, para barrar o abuso antes de qualquer trabalho
 * caro. O dono é isento: ele precisa conseguir administrar o bot mesmo depois
 * de muitos cliques seguidos.
 *
 * Quando o limite estoura, o usuário recebe uma resposta clara com o tempo de
 * espera, em vez de silêncio. Ficar mudo faria parecer que o bot quebrou.
 */

import type { Context, MiddlewareFn, Telegraf } from 'telegraf';

import type { Logger } from '../../core/logger.js';
import type { RateLimiter } from '../../core/rate-limiter.js';
import type { UserStore } from '../../data/user-store.js';

export interface RateLimitMiddlewareDeps {
  limiter: RateLimiter;
  logger: Logger;
  users: UserStore;
}

export const RATE_LIMIT_MESSAGE = (seconds: number): string =>
  [
    '✦ 𝐂𝐚𝐥𝐦𝐚 𝐥𝐚́!',
    '',
    `♛ 𝐕𝐨𝐜𝐞̂ 𝐟𝐞𝐳 𝐦𝐮𝐢𝐭𝐚𝐬 𝐬𝐨𝐥𝐢𝐜𝐢𝐭𝐚𝐜̧𝐨̃𝐞𝐬 𝐬𝐞𝐠𝐮𝐢𝐝𝐚𝐬.`,
    `✦ 𝐓𝐞𝐧𝐭𝐞 𝐧𝐨𝐯𝐚𝐦𝐞𝐧𝐭𝐞 𝐞𝐦 ${seconds} 𝐬𝐞𝐠𝐮𝐧𝐝𝐨𝐬.`,
  ].join('\n');

/**
 * O bot é de uso privado: cada usuário tem perfil, plano e dados próprios.
 *
 * Em grupo ele responderia a qualquer mensagem de qualquer membro, virando
 * spam e misturando os dados de todo mundo no mesmo perfil. Aqui ele ignora
 * tudo que não seja conversa privada. Devolve true quando deve ignorar.
 */
export function isIgnoredChat(ctx: Context): boolean {
  const tipo = ctx.chat?.type;
  if (tipo === undefined) {
    return false;
  }
  return tipo !== 'private';
}

export function createRateLimitMiddleware(
  deps: RateLimitMiddlewareDeps,
): MiddlewareFn<Context> {
  const logger = deps.logger.child('rate-limit');

  return async (ctx, next) => {
    // Grupo ou canal: ignora em silêncio, sem responder nada.
    if (isIgnoredChat(ctx)) {
      logger.debug(`Atualização ignorada: chat do tipo "${ctx.chat?.type}".`);
      return;
    }

    const userId = ctx.from?.id;

    // Sem usuário identificado não há o que limitar por ID.
    if (userId === undefined) {
      await next();
      return;
    }

    // O dono não é limitado: ele administra o bot e clica muito por natureza.
    if (deps.users.isOwner(userId)) {
      await next();
      return;
    }

    const { allowed, retryAfterSeconds } = deps.limiter.check(userId);

    if (!allowed) {
      logger.warn(`Usuário ${userId} excedeu o limite; aguardar ${retryAfterSeconds}s.`);
      // answerCbQuery precisa ser respondido em callbacks, senão o Telegram
      // deixa o botão "carregando" para sempre.
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery(`Muitas ações seguidas. Aguarde ${retryAfterSeconds}s.`).catch(() => undefined);
        return;
      }
      await ctx
        .reply(RATE_LIMIT_MESSAGE(retryAfterSeconds), { parse_mode: 'HTML' })
        .catch(() => undefined);
      return;
    }

    await next();
  };
}

/** Registra o middleware de limite antes dos demais handlers. */
export function registerRateLimit(bot: Telegraf, deps: RateLimitMiddlewareDeps): void {
  bot.use(createRateLimitMiddleware(deps));
}
