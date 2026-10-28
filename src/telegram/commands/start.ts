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

import type { Config } from '../../config/config.js';
import type { Logger } from '../../core/logger.js';
import type { MediaCache } from '../../data/media-cache.js';
import type { UserStore } from '../../data/user-store.js';
import type { WhatsAppManager } from '../../whatsapp/manager.js';
import {
  buildMenuCaption,
  menuKeyboardFor,
  resolveDisplayName,
  screenContext,
} from '../screens/screens.js';

export interface StartCommandDeps {
  config: Pick<Config, 'startMediaPath'>;
  logger: Logger;
  users: UserStore;
  mediaCache: MediaCache;
  /** Usado para montar o menu com o estado real do WhatsApp do usuário. */
  whatsapp: WhatsAppManager;
}

export function registerStartCommand(bot: Telegraf, deps: StartCommandDeps): void {
  const logger = deps.logger.child('start');

  bot.start(async (ctx) => {
    // Registra a visita primeiro: é aqui que firstSeenAt é definido.
    const record = ctx.from ? deps.users.touch(ctx.from) : null;
    // Mesma função usada pelas telas, para a saudação nunca divergir.
    const caption = buildMenuCaption(resolveDisplayName(record, ctx.from));
    // O dono recebe a linha extra do painel; os demais, o menu padrão.
    const keyboard = menuKeyboardFor({
      ...screenContext(record, ctx.from),
      whatsapp: ctx.from ? deps.whatsapp.getStatus(ctx.from.id) : undefined,
      ...(deps.users.isOwner(ctx.from?.id)
        ? {
            admin: {
              stats: deps.users.stats(),
              recentUsers: deps.users.recent(10),
              totalUsers: deps.users.count(),
            },
          }
        : {}),
    });

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
