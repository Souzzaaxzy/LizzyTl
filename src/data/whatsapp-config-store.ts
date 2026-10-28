/**
 * Número do WhatsApp usado pela 𝐋𝐢𝐳𝐳𝐲.
 *
 * Motivo de existir: o dono informa o número pelo próprio Telegram, então ele
 * precisa sobreviver ao reinício. Sem isso, cada reinício exigiria digitar o
 * número de novo.
 *
 * Fica em `data/`, que não é versionado: o número é dado pessoal do dono.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import type { Logger } from '../core/logger.js';

interface ConfigShape {
  version: 1;
  /** Número só com dígitos, com código do país. */
  number?: string;
}

export class WhatsappConfigStore {
  private readonly filePath: string;
  private readonly logger: Logger;
  private data: ConfigShape = { version: 1 };

  constructor(dataDir: string, logger: Logger) {
    this.filePath = path.join(dataDir, 'whatsapp.json');
    this.logger = logger.child('whatsapp-config');
    this.load();
  }

  private load(): void {
    try {
      if (!fs.existsSync(this.filePath)) {
        return;
      }
      const parsed: unknown = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      if (typeof parsed === 'object' && parsed !== null) {
        const numero = (parsed as { number?: unknown }).number;
        this.data = {
          version: 1,
          number: typeof numero === 'string' && numero !== '' ? numero : undefined,
        };
      }
    } catch (error) {
      // Arquivo ilegível não pode derrubar o bot: começa vazio e avisa.
      this.logger.warn('Arquivo de configuração do WhatsApp ilegível; será regravado.', error);
      this.data = { version: 1 };
    }
  }

  private save(): void {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      // 0o600: é dado pessoal do dono, não deve ser legível por outros.
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), { mode: 0o600 });
    } catch (error) {
      this.logger.error('Falha ao gravar a configuração do WhatsApp.', error);
    }
  }

  getNumber(): string | undefined {
    return this.data.number;
  }

  setNumber(number: string): void {
    this.data = { version: 1, number };
    this.save();
  }

  clear(): void {
    this.data = { version: 1 };
    this.save();
  }
}
