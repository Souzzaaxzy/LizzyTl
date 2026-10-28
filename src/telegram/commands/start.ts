/**
 * Comando /start da 𝐋𝐢𝐳𝐳𝐲 𝐝𝐨 𝐩𝐫𝐢𝐯𝐲.
 *
 * Requisito central: GIF, legenda e botões inline devem chegar ao usuário em
 * UMA única mensagem. Por isso o envio é feito com sendAnimation (que aceita
 * legenda e reply_markup) e, na ausência do arquivo, cai para uma única
 * mensagem de texto com os mesmos botões.
 */

import * as fs from 'node:fs';

import type { Telegraf } from 'telegraf';

import type { Config } from '../../config/config';
import type { Logger } from '../../core/logger';
import { buildMainMenuKeyboard, buildStartCaption } from '../menus/main-menu';
import { resolveStartMedia } from '../media/start-media';

export interface StartCommandDeps {
  config: Pick<Config, 'startGifPath' | 'startMp4Path' | 'startMediaMode'>;
  logger: Logger;
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
    const caption = buildStartCaption(displayName);
    const keyboard = buildMainMenuKeyboard();

    // Escolhe o arquivo disponível (MP4 tem prioridade no modo animação) e
    // informa o nome real, para o Telegram não tratar a animação como vídeo.
    const media = resolveStartMedia({ config: deps.config });

    if (media === null) {
      logger.warn(
        `Nenhuma mídia do menu encontrada em "${deps.config.startMp4Path}" nem em ` +
          `"${deps.config.startGifPath}". Enviando a mensagem com os botões sem a mídia. ` +
          'Adicione um dos arquivos para restaurar o formato normal.',
      );
      await ctx.reply(caption, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
      return;
    }

    const file = {
      source: fs.createReadStream(media.filePath),
      filename: media.filename,
    };
    const extra = {
      caption,
      parse_mode: 'HTML' as const,
      reply_markup: keyboard,
    };

    try {
      // sendAnimation e o metodo que faz a midia rodar sozinha, em loop
      // infinito, dentro do balao. Enviando um MP4 H.264 sem audio, o Telegram
      // usa o arquivo como esta, sem reencodar, e o loop se mantem.
      if (media.kind === 'document') {
        await ctx.replyWithDocument(file, extra);
      } else {
        await ctx.replyWithAnimation(file, extra);
      }
    } catch (error) {
      logger.error('Falha ao enviar o GIF do menu; enviando a mensagem sem o GIF.', error);
      await ctx.reply(caption, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    }
  });
}
