/**
 * Escolha do arquivo de mídia do menu.
 *
 * Motivo de existir: o Telegram reencoda GIF para MP4 antes de exibir como
 * animação, e nessa reencodagem o loop pode se perder. Enviando um MP4 já
 * pronto (H.264, sem áudio), o Telegram usa o arquivo como está e a animação
 * roda em loop. O GIF continua sendo a alternativa quando o MP4 não existe.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import type { Config } from '../../config/config';

export type MediaKind = 'animation' | 'document';

export interface ResolvedMedia {
  kind: MediaKind;
  /** Caminho absoluto do arquivo escolhido. */
  filePath: string;
  /** Nome enviado ao Telegram; a extensão define como ele interpreta a mídia. */
  filename: string;
}

/**
 * Ordem de preferência de cada modo:
 * - animation: MP4 primeiro, porque dispensa a reencodagem que quebra o loop.
 * - document: GIF primeiro, porque o objetivo é preservar o arquivo original.
 */
const CANDIDATES: Record<MediaKind, ReadonlyArray<'startMp4Path' | 'startGifPath'>> = {
  animation: ['startMp4Path', 'startGifPath'],
  document: ['startGifPath', 'startMp4Path'],
};

export interface ResolveMediaOptions {
  config: Pick<Config, 'startMediaMode' | 'startGifPath' | 'startMp4Path'>;
  /** Injetável para facilitar o teste sem tocar no disco. */
  exists?: (filePath: string) => boolean;
}

/**
 * Devolve o arquivo que deve ser enviado, ou null quando nenhum existe.
 * O primeiro candidato existente vence; a extensão real do arquivo é sempre
 * usada no nome enviado, para o Telegram não confundir animação com vídeo.
 */
export function resolveStartMedia(options: ResolveMediaOptions): ResolvedMedia | null {
  const { config } = options;
  const exists = options.exists ?? fs.existsSync;
  const kind: MediaKind = config.startMediaMode === 'document' ? 'document' : 'animation';

  for (const key of CANDIDATES[kind]) {
    const candidate = config[key];
    if (candidate && exists(candidate)) {
      return { kind, filePath: candidate, filename: path.basename(candidate) };
    }
  }

  return null;
}
