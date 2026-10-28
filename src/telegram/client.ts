/**
 * Criação do cliente do Telegram.
 *
 * A conexão do Telegram é independente da futura conexão do WhatsApp: este
 * módulo não conhece nem depende de nada em src/whatsapp.
 */

import { Telegraf } from 'telegraf';

import type { Logger } from '../core/logger.js';

export interface CreateBotOptions {
  token: string;
  logger: Logger;
}

export function createBot({ token, logger }: CreateBotOptions): Telegraf {
  const bot = new Telegraf(token);

  // Captura qualquer erro não tratado em handlers para que uma falha isolada
  // não derrube o processo nem deixe o usuário sem resposta.
  bot.catch((error: unknown, ctx) => {
    logger.error(`Erro ao processar a atualização ${ctx.update.update_id}`, error);
  });

  return bot;
}
