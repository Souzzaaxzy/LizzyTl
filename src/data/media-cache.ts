/**
 * Cache do file_id da mídia do menu.
 *
 * Motivo de existir: reenviar o arquivo a cada /start desperdiça banda e tempo.
 * Na primeira vez o Telegram devolve um file_id; nas seguintes, enviamos o
 * file_id em vez do arquivo. O valor fica em DATA_DIR (não versionado) porque é
 * específico do bot que fez o upload.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import type { Logger } from '../core/logger';

interface CacheShape {
  version: 1;
  /** Caminho do arquivo de origem a que o file_id pertence. */
  mediaPath: string;
  fileId: string;
  /**
   * Assinatura do arquivo no momento do upload (tamanho + mtime). Sem isso,
   * trocar o arquivo no disco continuaria enviando o file_id da mídia antiga.
   */
  signature?: string;
}

/**
 * Assinatura barata do arquivo: tamanho + data de modificação. Muda quando o
 * arquivo é substituído, sem precisar ler o conteúdo inteiro.
 */
export function fileSignature(mediaPath: string): string | undefined {
  try {
    const info = fs.statSync(mediaPath);
    return `${info.size}:${info.mtimeMs}`;
  } catch {
    return undefined;
  }
}

export class MediaCache {
  private readonly filePath: string;
  private readonly logger: Logger;
  private data: CacheShape | null = null;

  constructor(dataDir: string, logger: Logger) {
    this.filePath = path.join(dataDir, 'media-cache.json');
    this.logger = logger.child('media-cache');
    this.load();
  }

  private load(): void {
    try {
      if (!fs.existsSync(this.filePath)) {
        return;
      }
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as CacheShape;
      if (parsed && typeof parsed.fileId === 'string' && typeof parsed.mediaPath === 'string') {
        this.data = parsed;
      }
    } catch (error) {
      this.logger.warn('Cache de mídia ilegível; será regravado.', error);
      this.data = null;
    }
  }

  /**
   * Devolve o file_id apenas se ele pertencer ao arquivo informado **e** o
   * arquivo não tiver sido trocado desde o upload.
   */
  get(mediaPath: string): string | undefined {
    if (this.data?.mediaPath !== mediaPath) {
      return undefined;
    }
    // Cache antigo, gravado antes da assinatura existir: descarta uma vez e
    // regrava no próximo envio.
    if (this.data.signature === undefined) {
      return undefined;
    }
    if (this.data.signature !== fileSignature(mediaPath)) {
      return undefined;
    }
    return this.data.fileId;
  }

  set(mediaPath: string, fileId: string): void {
    this.data = { version: 1, mediaPath, fileId, signature: fileSignature(mediaPath) };
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), { mode: 0o600 });
    } catch (error) {
      // Falha de cache não é fatal: na próxima vez o arquivo é reenviado.
      this.logger.warn('Falha ao gravar o cache de mídia.', error);
    }
  }
}
