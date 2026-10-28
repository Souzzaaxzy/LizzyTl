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
  config: Pick<Config, 'startGifPath'>;
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

    // Envia a mídia do menu junto com a legenda e os botões, tudo em uma única
    // mensagem. O caminho é configurável e a existência é checada a cada
    // execução, para que adicionar o arquivo restaure o formato normal.
    const mediaPath = deps.config.startGifPath;

    if (!fs.existsSync(mediaPath)) {
      logger.warn(
        `Mídia do menu não encontrada em "${mediaPath}". ` +
          'Enviando a mensagem com os botões sem a mídia. ' +
          'Adicione o arquivo nesse caminho para restaurar o formato normal.',
      );
      await ctx.reply(caption, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
      return;
    }

    try {
      // sendAnimation exibe a mídia rodando sozinha, em loop, dentro do balão.
      // O filename informa a extensão real, para o Telegram não tratar o
      // arquivo como vídeo comum.
      await ctx.replyWithAnimation(
        {
          source: fs.createReadStream(mediaPath),
          filename: path.basename(mediaPath),
        },
        {
          caption,
          parse_mode: 'HTML',
          reply_markup: keyboard,
        },
      );
    } catch (error) {
      logger.error('Falha ao enviar o GIF do menu; enviando a mensagem sem o GIF.', error);
      await ctx.reply(caption, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    }
  });
}
