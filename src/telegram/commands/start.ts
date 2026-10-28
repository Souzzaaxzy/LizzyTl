/**
 * Comando /start da 𝐋𝐢𝐳𝐳𝐲 𝐝𝐨 𝐩𝐫𝐢𝐯𝐲.
 *
 * Requisito central: GIF, legenda e botões inline devem chegar ao usuário em
 * UMA única mensagem. Por isso o envio é feito com sendAnimation (que aceita
 * legenda e reply_markup) e, na ausência do arquivo, cai para uma única
 * mensagem de texto com os mesmos botões.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import type { Telegraf } from 'telegraf';

import type { Config } from '../../config/config';
import type { Logger } from '../../core/logger';
import { buildMainMenuKeyboard, buildStartCaption } from '../menus/main-menu';

export interface StartCommandDeps {
  config: Pick<Config, 'startGifPath' | 'startMediaMode'>;
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

    // O caminho do GIF é configurável; a existência é checada a cada execução
    // para que, ao adicionar o arquivo, o envio volte ao formato normal.
    const gifExists = fs.existsSync(deps.config.startGifPath);

    if (!gifExists) {
      logger.warn(
        `GIF do menu não encontrado em "${deps.config.startGifPath}". ` +
          'Enviando a mensagem com os botões sem o GIF. ' +
          'Adicione o arquivo nesse caminho para restaurar o formato normal.',
      );
      await ctx.reply(caption, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
      return;
    }

    // O nome do arquivo precisa terminar em .gif para o Telegram tratar como
    // animacao. Sem ele, o Telegraf usa o padrao "animation.mp4".
    const media = {
      source: fs.createReadStream(deps.config.startGifPath),
      filename: path.basename(deps.config.startGifPath),
    };

    try {
      // sendAnimation e o metodo que faz a midia rodar sozinha, em loop
      // infinito, dentro do balao (o Telegram normaliza o GIF para MP4, mas
      // mantem o comportamento de animacao). Legenda e botoes vao na mesma
      // mensagem. Use START_MEDIA_MODE=document para enviar como arquivo .gif.
      if (deps.config.startMediaMode === 'document') {
        await ctx.replyWithDocument(media, {
          caption,
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
      } else {
        await ctx.replyWithAnimation(media, {
          caption,
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
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
