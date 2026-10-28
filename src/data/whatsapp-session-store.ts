/**
 * Sessões de WhatsApp, uma por usuário.
 *
 * O bot é público: cada usuário conecta o próprio número, com sessão isolada.
 * O isolamento é o ponto crítico — se as sessões se misturassem, um usuário
 * poderia enviar mensagens pela conta de outro.
 *
 * Cada sessão guarda o número e o diretório onde ficam as credenciais:
 *
 *   data/whatsapp/<userId>.json      número do usuário
 *   data/whatsapp-auth/<userId>/     credenciais da sessão
 *
 * Nada disso é versionado: são dados pessoais de quem usa o bot.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import type { Logger } from '../core/logger.js';

interface SessionShape {
  version: 1;
  /** Número só com dígitos, com código do país. */
  number?: string;
  /** Quando a sessão foi criada, em ISO. */
  createdAt?: string;
}

export interface WhatsappSession {
  userId: number;
  number?: string;
  authDir: string;
  createdAt?: string;
}

export class WhatsappSessionStore {
  private readonly sessionsDir: string;
  private readonly authRoot: string;
  private readonly logger: Logger;

  constructor(dataDir: string, logger: Logger) {
    this.sessionsDir = path.join(dataDir, 'whatsapp');
    this.authRoot = path.join(dataDir, 'whatsapp-auth');
    this.logger = logger.child('whatsapp-sessions');
  }

  /** Diretório de credenciais de um usuário. Nome derivado do ID numérico. */
  authDirFor(userId: number): string {
    return path.join(this.authRoot, String(userId));
  }

  private fileFor(userId: number): string {
    return path.join(this.sessionsDir, `${userId}.json`);
  }

  /** Lê a sessão de um usuário, ou null quando ele nunca conectou. */
  get(userId: number): WhatsappSession | null {
    const filePath = this.fileFor(userId);
    let numero: string | undefined;
    let createdAt: string | undefined;

    try {
      if (fs.existsSync(filePath)) {
        const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (typeof parsed === 'object' && parsed !== null) {
          const bruto = (parsed as { number?: unknown }).number;
          const criado = (parsed as { createdAt?: unknown }).createdAt;
          numero = typeof bruto === 'string' && bruto !== '' ? bruto : undefined;
          createdAt = typeof criado === 'string' ? criado : undefined;
        }
      }
    } catch (error) {
      // Arquivo ilegível não pode derrubar o bot: trata como sem sessão.
      this.logger.warn(`Sessão do usuário ${userId} ilegível; será regravada.`, error);
    }

    return {
      userId,
      number: numero,
      authDir: this.authDirFor(userId),
      createdAt,
    };
  }

  /** Grava (ou atualiza) a sessão de um usuário. */
  set(userId: number, number: string): WhatsappSession {
    const existente = this.get(userId);
    const dado: SessionShape = {
      version: 1,
      number,
      createdAt: existente?.createdAt ?? new Date().toISOString(),
    };

    try {
      fs.mkdirSync(this.sessionsDir, { recursive: true, mode: 0o700 });
      // 0o600: número de telefone é dado pessoal de quem usa o bot.
      fs.writeFileSync(this.fileFor(userId), JSON.stringify(dado, null, 2), { mode: 0o600 });
    } catch (error) {
      this.logger.error(`Falha ao gravar a sessão do usuário ${userId}.`, error);
    }

    return {
      userId,
      number,
      authDir: this.authDirFor(userId),
      createdAt: dado.createdAt,
    };
  }

  /**
   * Apaga a sessão de um usuário: o registro do número e as credenciais.
   *
   * As credenciais precisam sair junto, senão um novo pareamento encontraria
   * a sessão antiga e se recusaria a gerar um código.
   */
  clear(userId: number): void {
    try {
      fs.rmSync(this.fileFor(userId), { force: true });
    } catch (error) {
      this.logger.warn(`Falha ao apagar o registro da sessão ${userId}.`, error);
    }
    this.clearAuth(userId);
  }

  /** Apaga só as credenciais, mantendo o número guardado. */
  clearAuth(userId: number): void {
    try {
      fs.rmSync(this.authDirFor(userId), { recursive: true, force: true });
    } catch (error) {
      this.logger.warn(`Falha ao apagar as credenciais da sessão ${userId}.`, error);
    }
  }

  /** IDs de todos os usuários que já conectaram um número. */
  listUserIds(): number[] {
    try {
      if (!fs.existsSync(this.sessionsDir)) {
        return [];
      }
      return fs
        .readdirSync(this.sessionsDir)
        .filter((nome) => nome.endsWith('.json'))
        .map((nome) => Number(nome.replace(/\.json$/, '')))
        .filter((id) => Number.isInteger(id) && id > 0);
    } catch (error) {
      this.logger.warn('Falha ao listar as sessões do WhatsApp.', error);
      return [];
    }
  }

  /** Quantas sessões existem. Usado para checar o limite antes de aceitar mais. */
  count(): number {
    return this.listUserIds().length;
  }
}
