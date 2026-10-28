/**
 * Gerencia todas as sessões de WhatsApp do bot.
 *
 * O bot é público: cada usuário conecta o próprio número, e cada um tem um
 * socket e credenciais isolados. O isolamento é o ponto crítico — se as
 * sessões se misturassem, um usuário poderia enviar mensagens pela conta de
 * outro.
 *
 * O manager existe para que o resto do bot nunca mexa em socket direto: ele
 * pede "o estado do usuário 42" ou "conecte o número X para o usuário 42".
 */

import type { Logger } from '../core/logger.js';
import type { WhatsappSessionStore } from '../data/whatsapp-session-store.js';
import {
  WhatsAppClient,
  type WhatsAppStatus,
} from './client.js';
import type { BaileysMakeSocket, BaileysModule } from './baileys-types.js';

/** Resposta a um pedido de conexão, com o motivo quando não deu. */
export interface ConnectResult {
  ok: boolean;
  /** Mensagem pronta para mostrar ao usuário quando ok é false. */
  message?: string;
}

/**
 * O bot é público e cada usuário tem direito a **um** número.
 *
 * Reconectar o mesmo usuário é permitido: a sessão antiga é encerrada antes de
 * parear de novo. O que não existe é acumular números na mesma conta.
 */
export const MAX_SESSIONS_PER_USER = 1;

export interface WhatsAppManagerDeps {
  store: WhatsappSessionStore;
  logger: Logger;
  /** Código de pareamento, validado pelo cliente. */
  pairingCode: string;
  /** Teto de sessões simultâneas, para não estourar a memória da máquina. */
  maxSessions: number;
  /** Injetável para testar sem abrir conexão real. */
  createSocket?: BaileysMakeSocket;
  /** Injetável para testar sem ler o pacote do disco. */
  loadModule?: () => Promise<BaileysModule>;
  /** Avisa o usuário quando o código de pareamento dele fica pronto. */
  onPairingCode: (userId: number, code: string) => void;
}

const DESLIGADO: WhatsAppStatus = {
  state: 'desligado',
  summary: 'Desligado. Toque em "Conectar WhatsApp" para informar o número.',
};

export class WhatsAppManager {
  private readonly deps: WhatsAppManagerDeps;
  private readonly logger: Logger;
  private readonly clientes = new Map<number, WhatsAppClient>();

  constructor(deps: WhatsAppManagerDeps) {
    this.deps = deps;
    this.logger = deps.logger.child('whatsapp-manager');
  }

  /**
   * Estado de um usuário. Quem nunca conectou aparece como desligado, sem
   * criar sessão à toa.
   */
  getStatus(userId: number): WhatsAppStatus {
    return this.clientes.get(userId)?.getStatus() ?? DESLIGADO;
  }

  /** Verdadeiro somente com conexão real e aberta para aquele usuário. */
  isConnected(userId: number): boolean {
    return this.clientes.get(userId)?.isConnected() ?? false;
  }

  /** Quantas sessões estão ativas na memória. */
  activeCount(): number {
    return this.clientes.size;
  }

  /** Quantos usuários já têm número guardado. */
  configuredCount(): number {
    return this.deps.store.count();
  }

  /**
   * Sobe as sessões de todos os usuários que já conectaram antes.
   *
   * Falha em uma sessão não pode impedir as outras de subir: cada uma é
   * independente, como o WhatsApp é independente do Telegram.
   */
  async startAll(): Promise<void> {
    const ids = this.deps.store.listUserIds();
    if (ids.length === 0) {
      this.logger.info('Nenhuma sessão de WhatsApp para retomar.');
      return;
    }

    this.logger.info(`Retomando ${ids.length} sessão(ões) de WhatsApp...`);
    await Promise.all(
      ids.map(async (userId) => {
        try {
          await this.start(userId);
        } catch (error) {
          this.logger.error(`Falha ao retomar a sessão do usuário ${userId}.`, error);
        }
      }),
    );
  }

  /** Cria e inicia o cliente de um usuário, se ainda não existir. */
  private async start(userId: number): Promise<WhatsAppClient> {
    const existente = this.clientes.get(userId);
    if (existente) {
      return existente;
    }

    const session = this.deps.store.get(userId);
    if (session === null) {
      throw new Error(`Usuário ${userId} não tem sessão configurada.`);
    }

    const cliente = new WhatsAppClient({
      config: { whatsappPairingCode: this.deps.pairingCode },
      logger: this.deps.logger,
      session,
      createSocket: this.deps.createSocket,
      loadModule: this.deps.loadModule,
      // O código vai para o usuário dono daquela sessão, nunca para outro.
      onPairingCode: (codigo) => this.deps.onPairingCode(userId, codigo),
    });

    this.clientes.set(userId, cliente);
    await cliente.start();
    return cliente;
  }

  /**
   * Conecta um número novo para o usuário.
   *
   * Duas checagens antes de criar sessão:
   * - o teto global, para uma conta nova não derrubar as que já rodam;
   * - uma sessão por usuário, que é a regra do bot público.
   *
   * Reconectar o mesmo usuário é permitido: a sessão anterior dele é
   * encerrada antes de parear de novo.
   */
  async connect(userId: number, rawNumber: string): Promise<ConnectResult> {
    const jaTem = this.clientes.has(userId);
    if (!jaTem && this.clientes.size >= this.deps.maxSessions) {
      this.logger.warn(
        `Limite de ${this.deps.maxSessions} sessões atingido; recusando o usuário ${userId}.`,
      );
      return {
        ok: false,
        message:
          'O limite de conexões do bot foi atingido. Tente novamente mais tarde.',
      };
    }

    // Sessão anterior deste usuário precisa sair antes de parear de novo: é
    // assim que a regra de uma sessão por usuário se mantém.
    this.desconectar(userId);

    const cliente = new WhatsAppClient({
      config: { whatsappPairingCode: this.deps.pairingCode },
      logger: this.deps.logger,
      session: this.deps.store.get(userId)!,
      createSocket: this.deps.createSocket,
      loadModule: this.deps.loadModule,
      onPairingCode: (codigo) => this.deps.onPairingCode(userId, codigo),
    });
    this.clientes.set(userId, cliente);

    const aceitou = await cliente.connectNumber(rawNumber);
    if (!aceitou) {
      this.clientes.delete(userId);
      return {
        ok: false,
        message: cliente.getStatus().summary,
      };
    }

    // Só grava o número depois de aceitar: número inválido não deixa rastro.
    this.deps.store.set(userId, cliente.numeroConectado() ?? rawNumber);
    return { ok: true };
  }

  /**
   * Encerra a sessão de um usuário e apaga as credenciais dele.
   *
   * Só afeta aquele usuário: as outras sessões continuam rodando.
   */
  desconectar(userId: number): void {
    const cliente = this.clientes.get(userId);
    if (cliente) {
      cliente.desconectar();
      this.clientes.delete(userId);
    }
    this.deps.store.clear(userId);
  }

  /** Encerra todas as sessões, para o desligamento organizado do processo. */
  stopAll(): void {
    for (const cliente of this.clientes.values()) {
      try {
        cliente.stop();
      } catch (error) {
        this.logger.warn('Falha ao encerrar uma sessão de WhatsApp.', error);
      }
    }
    this.clientes.clear();
  }
}
