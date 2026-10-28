/**
 * Persistência local dos usuários em JSON.
 *
 * Motivo de existir: o perfil precisa de dados que sobrevivam ao reinício
 * (data de entrada, plano, contagem de acessos). Um arquivo JSON resolve nesta
 * etapa e funciona no Termux sem dependências externas.
 *
 * O arquivo fica em DATA_DIR, que não é versionado. A escrita é atômica: grava
 * em um arquivo temporário e renomeia, para não corromper o JSON em caso de
 * queda no meio da gravação.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import type { Logger } from '../core/logger';

export type Plan = 'padrao' | 'dono';

export interface UserRecord {
  id: number;
  username?: string;
  firstName: string;
  plan: Plan;
  firstSeenAt: string;
  lastSeenAt: string;
  accessCount: number;
}

export interface TelegramUserLike {
  id: number;
  username?: string;
  first_name?: string;
}

interface StoreShape {
  version: 1;
  users: Record<string, UserRecord>;
}

export interface UserStoreOptions {
  dataDir: string;
  logger: Logger;
  /** ID do dono, quando definido por OWNER_TELEGRAM_ID. */
  ownerId?: number;
}

export class UserStore {
  private readonly filePath: string;
  private readonly logger: Logger;
  private readonly ownerId: number | undefined;
  private users: Record<string, UserRecord> = {};

  constructor(options: UserStoreOptions) {
    this.filePath = path.join(options.dataDir, 'users.json');
    this.logger = options.logger.child('store');
    this.ownerId = options.ownerId;
    this.load();
  }

  private load(): void {
    if (!fs.existsSync(this.filePath)) {
      return;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as StoreShape;
      if (parsed && typeof parsed === 'object' && parsed.users) {
        this.users = parsed.users;
      }
    } catch (error) {
      // Arquivo corrompido não deve derrubar o bot: começa vazio e avisa.
      this.logger.warn(
        `Não foi possível ler "${this.filePath}". Começando com base vazia; o arquivo será regravado.`,
        error,
      );
      this.users = {};
    }
  }

  private save(): void {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      const payload: StoreShape = { version: 1, users: this.users };
      const tmpPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2));
      fs.renameSync(tmpPath, this.filePath);
    } catch (error) {
      this.logger.error(`Falha ao gravar "${this.filePath}".`, error);
    }
  }

  /**
   * Registra uma visita. Cria o registro no primeiro /start e, nos seguintes,
   * atualiza os dados do Telegram e incrementa a contagem de acessos. A data de
   * entrada é definida uma única vez.
   */
  touch(user: TelegramUserLike): UserRecord {
    const key = String(user.id);
    const now = new Date().toISOString();
    const existing = this.users[key];

    const record: UserRecord = existing
      ? {
          ...existing,
          username: user.username,
          firstName: user.first_name ?? existing.firstName,
          lastSeenAt: now,
          accessCount: existing.accessCount + 1,
        }
      : {
          id: user.id,
          username: user.username,
          firstName: user.first_name ?? 'sem nome',
          plan: 'padrao',
          firstSeenAt: now,
          lastSeenAt: now,
          accessCount: 1,
        };

    record.plan = this.planFor(user.id);
    this.users[key] = record;
    this.save();
    return record;
  }

  get(id: number): UserRecord | undefined {
    return this.users[String(id)];
  }

  private planFor(id: number): Plan {
    return this.ownerId !== undefined && id === this.ownerId ? 'dono' : 'padrao';
  }
}
