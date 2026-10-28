/**
 * Comandos publicados no Telegram.
 *
 * O setMyCommands registra a lista na API, e ela aparece quando o usuário
 * digita "/" no chat. A lista vem de BOT_COMMANDS, a mesma usada pelo /help,
 * então não há dois lugares para manter em sincronia.
 *
 * Uma falha aqui não pode impedir o bot de subir: o registro é best-effort.
 */

import type { Telegraf } from 'telegraf';

import type { Logger } from '../../core/logger';
import { BOT_COMMANDS } from '../screens/screens';

export async function publishBotCommands(bot: Telegraf, logger: Logger): Promise<void> {
  try {
    await bot.telegram.setMyCommands(
      BOT_COMMANDS.map((c) => ({ command: c.command, description: c.description })),
    );
    logger.info(`Comandos publicados no Telegram: ${BOT_COMMANDS.map((c) => '/' + c.command).join(', ')}`);
  } catch (error) {
    logger.warn('Não foi possível publicar os comandos no Telegram. O bot segue funcionando.', error);
  }
}
