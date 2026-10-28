/**
 * Comando /start da 𝐋𝐢𝐳𝐳𝐲 𝐝𝐨 𝐩𝐫𝐢𝐯𝐲.
 *
 * Requisito central: mídia, legenda e botões inline devem chegar ao usuário em
 * UMA única mensagem. O envio usa sendAnimation, que aceita legenda e
 * reply_markup, e na ausência do arquivo cai para uma mensagem de texto com os
 * mesmos botões.
 *
 * O /start também registra o usuário: é aqui que a data de entrada é gravada.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import type { Telegraf } from 'telegraf';

import type { Config } from '../../config/config';
import type { Logger } from '../../core/logger';
import type { MediaCache } from '../../data/media-cache';
import type { UserStore } from '../../data/user-store';
import { buildMenuCaption, buildMenuKeyboard } from '../screens/screens';

export interface StartCommandDeps {
  config: Pick<Config, 'startMediaPath'>;
  logger: Logger;
  users: UserStore;
  mediaCache: MediaCache;
}

/**
 * Resolve o nome exibido na saudação.
 * Prefere o @username; se não houver, usa o primeiro nome; por último, um
 * rótulo neutro. Nunca devolve "@usuario" nem uma string vazia.
 */
export function resolveDisplayName(user?: {
  username?: string;
  first_name?: string;
}): string {
  const username = user?.username?.trim();
  if (username) {
    return `@${username}`;
  }
  const firstName = user?.first_name?.trim();
  if (firstName) {
    return firstName;
  }
  return 'usuário';
}

export function registerStartCommand(bot: Telegraf, deps: StartCommandDeps): void {
  const logger = deps.logger.child('start');

  bot.start(async (ctx) => {
    const displayName = resolveDisplayName(ctx.from);
    const caption = buildMenuCaption(displayName);
    const keyboard = buildMenuKeyboard();

    // Registra a visita. É aqui que firstSeenAt é definido pela primeira vez.
    if (ctx.from) {
      deps.users.touch(ctx.from);
    }

    const mediaPath = deps.config.startMediaPath;
    if (!fs.existsSync(mediaPath)) {
      logger.warn(
        `Mídia do menu não encontrada em "${mediaPath}". ` +
          'Enviando a mensagem com os botões sem a mídia. ' +
          'Adicione o arquivo nesse caminho para restaurar o formato normal.',
      );
      await ctx.reply(caption, { parse_mode: 'HTML', reply_markup: keyboard });
      return;
    }

    const extra = {
      caption,
      parse_mode: 'HTML' as const,
      reply_markup: keyboard,
    };

    try {
      // Reusa o file_id quando disponível: evita reenviar o arquivo inteiro.
      const cachedFileId = deps.mediaCache.get(mediaPath);
      const animation = cachedFileId ?? {
        source: fs.createReadStream(mediaPath),
        filename: path.basename(mediaPath),
      };

      const message = await ctx.replyWithAnimation(animation, extra);

      if (!cachedFileId && message.animation) {
        deps.mediaCache.set(mediaPath, message.animation.file_id);
      }
    } catch (error) {
      logger.error('Falha ao enviar a mídia do menu; enviando a mensagem sem ela.', error);
      await ctx.reply(caption, { parse_mode: 'HTML', reply_markup: keyboard });
    }
  });
}
