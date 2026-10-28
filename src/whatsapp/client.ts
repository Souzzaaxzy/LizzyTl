/**
 * Conexão com o WhatsApp da 𝐋𝐢𝐳𝐳𝐲 𝐝𝐨 𝐩𝐫𝐢𝐯𝐲.
 *
 * Usa o fork da Baileys definido pelo proprietário (`@souzzaaxzy/baileys`).
 * A conexão é totalmente independente da do Telegram: uma falha aqui não
 * derruba o bot, e vice-versa.
 *
 * Pareamento por código, não por QR: no Termux o terminal é pequeno e ler um
 * QR é ruim. O código tem 8 caracteres porque o WhatsApp só aceita esse
 * tamanho, no alfabeto Crockford Base32 (sem I, O, L nem símbolos).
 *
 * A sessão autenticada fica em `data/whatsapp-auth/`, que não é versionado.
 */

import * as fs from 'node:fs';

import type { Config } from '../config/config.js';
import type { Logger } from '../core/logger.js';
import {
  loadBaileys,
  type BaileysConnectionUpdate,
  type BaileysMakeSocket,
  type BaileysModule,
  type BaileysSocket,
} from './baileys-loader.js';

/** Estado honesto da conexão. Nunca reporte "conectado" sem sessão validada. */
export type WhatsAppState =
  | 'desligado'
  | 'conectando'
  | 'aguardando_pareamento'
  | 'conectado'
  | 'erro';

export interface WhatsAppStatus {
  state: WhatsAppState;
  /** Texto curto e verdadeiro sobre o estado atual, usado na tela do menu. */
  summary: string;
}

export interface WhatsAppClientDeps {
  config: Pick<Config, 'whatsappNumber' | 'whatsappPairingCode' | 'whatsappAuthDir'>;
  logger: Logger;
  /** Injetável para testar sem abrir conexão real. */
  createSocket?: BaileysMakeSocket;
  /** Injetável para testar sem ler o pacote do disco. */
  loadModule?: () => Promise<BaileysModule>;
}

/** Logger silencioso: o Baileys é muito verboso e poluiria o log da Lizzy. */
const silentLogger = {
  level: 'silent',
  child: () => silentLogger,
  trace: () => undefined,
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  fatal: () => undefined,
};

/**
 * Normaliza o número para o formato que o WhatsApp espera: só dígitos, com
 * código do país. O usuário pode digitar com +, espaço, traço ou parênteses.
 */
export function normalizeWhatsappNumber(raw: string): string {
  return raw.replace(/\D/g, '');
}

/**
 * Valida o código de pareamento contra as regras do WhatsApp: exatamente 8
 * caracteres do alfabeto Crockford Base32.
 *
 * Vale checar antes de tentar: o fork rejeita localmente, mas a mensagem dele
 * é técnica e não explica o que fazer.
 */
export const PAIRING_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTVWXYZ';

export function isValidPairingCode(code: string): boolean {
  if (code.length !== 8) {
    return false;
  }
  return [...code.toUpperCase()].every((ch) => PAIRING_ALPHABET.includes(ch));
}

export class WhatsAppClient {
  private readonly config: WhatsAppClientDeps['config'];
  private readonly logger: Logger;
  private readonly createSocket: BaileysMakeSocket | undefined;
  private readonly loadModule: () => Promise<BaileysModule>;
  private socket: BaileysSocket | null = null;
  private status: WhatsAppStatus = { state: 'desligado', summary: 'Desligado.' };
  private parado = false;
  private tentativa = 0;
  /** Código que indica sessão encerrada no celular, vindo do fork. */
  private loggedOutCode: number | undefined;

  constructor(deps: WhatsAppClientDeps) {
    this.config = deps.config;
    this.logger = deps.logger.child('whatsapp');
    this.createSocket = deps.createSocket;
    this.loadModule = deps.loadModule ?? loadBaileys;
  }

  /** Estado atual, para a tela do menu. */
  getStatus(): WhatsAppStatus {
    return this.status;
  }

  /** Verdadeiro somente com conexão real e aberta. */
  isConnected(): boolean {
    return this.status.state === 'conectado';
  }

  private setStatus(state: WhatsAppState, summary: string): void {
    this.status = { state, summary };
  }

  /**
   * Inicia a conexão. Sem número configurado, fica desligado em vez de tentar
   * conectar — o operador precisa saber que falta configuração.
   */
  async start(): Promise<void> {
    if (this.config.whatsappNumber === undefined) {
      this.setStatus(
        'desligado',
        'Desligado: defina WHATSAPP_NUMBER no .env para conectar.',
      );
      this.logger.info('WhatsApp desligado: WHATSAPP_NUMBER não configurado.');
      return;
    }

    if (!isValidPairingCode(this.config.whatsappPairingCode)) {
      this.setStatus(
        'erro',
        'Código de pareamento inválido: precisa de 8 caracteres, sem I, O, L ou símbolos.',
      );
      this.logger.error(
        `Código de pareamento inválido: "${this.config.whatsappPairingCode}". ` +
          'Use 8 caracteres do alfabeto ' +
          PAIRING_ALPHABET,
      );
      return;
    }

    await this.connect();
  }

  private async connect(): Promise<void> {
    this.parado = false;
    this.setStatus('conectando', 'Conectando...');

    try {
      fs.mkdirSync(this.config.whatsappAuthDir, { recursive: true, mode: 0o700 });
      const modulo = await this.loadModule();
      const { state, saveCreds } = await modulo.useMultiFileAuthState(this.config.whatsappAuthDir);

      const criar: BaileysMakeSocket = this.createSocket ?? modulo.makeWASocket;
      const socket = criar({
        auth: state,
        logger: silentLogger,
        browser: modulo.Browsers.ubuntu('Chrome'),
      });
      this.socket = socket;

      socket.ev.on('creds.update', () => {
        void saveCreds();
      });

      this.loggedOutCode = modulo.DisconnectReason.loggedOut;
      socket.ev.on('connection.update', (update) => {
        void this.onConnectionUpdate(update);
      });

      // Sem sessão salva, pede o pareamento por código.
      if (!state.creds.registered) {
        await this.requestPairing();
      }
    } catch (error) {
      this.logger.error('Falha ao iniciar a conexão com o WhatsApp.', error);
      this.setStatus('erro', 'Falha ao conectar. Veja o log para o motivo.');
      this.agendarReconexao();
    }
  }

  /**
   * Pede o código de pareamento. O código expira em cerca de um minuto, então
   * ele é pedido no momento certo e não fica guardado esperando.
   */
  private async requestPairing(): Promise<void> {
    const socket = this.socket;
    const numero = this.config.whatsappNumber;
    if (socket === null || numero === undefined) {
      return;
    }

    const pedirCodigo = socket.requestPairingCode;
    if (typeof pedirCodigo !== 'function') {
      this.logger.error('O fork da Baileys não expõe requestPairingCode.');
      this.setStatus('erro', 'O fork da Baileys não suporta pareamento por código.');
      return;
    }

    try {
      const codigo = await pedirCodigo.call(socket, numero, this.config.whatsappPairingCode);
      this.setStatus(
        'aguardando_pareamento',
        `Aguardando pareamento. No WhatsApp, abra Aparelhos conectados e use o código ${codigo}.`,
      );
      // O código é mostrado no terminal de propósito: é assim que o operador
      // pareia. Não é segredo — vale só uma vez e expira em cerca de um minuto.
      this.logger.info(`Código de pareamento do WhatsApp: ${codigo}`);
      this.logger.info(
        'No celular: WhatsApp > Aparelhos conectados > Conectar aparelho > ' +
          'Conectar com número de telefone.',
      );
    } catch (error) {
      this.logger.error('Falha ao pedir o código de pareamento.', error);
      this.setStatus('erro', 'Não foi possível gerar o código de pareamento. Veja o log.');
    }
  }

  private async onConnectionUpdate(u: BaileysConnectionUpdate): Promise<void> {
    if (u.connection === 'open') {
      this.tentativa = 0;
      this.setStatus('conectado', 'Conectado.');
      this.logger.info('WhatsApp conectado.');
      return;
    }

    if (u.connection === 'close') {
      const codigo = u.lastDisconnect?.error?.output?.statusCode;

      // Sessão encerrada no celular: não adianta reconectar, precisa parear de novo.
      if (codigo === this.loggedOutCode) {
        this.logger.warn(
          'Sessão do WhatsApp encerrada no celular. Apague "data/whatsapp-auth" e reinicie para parear de novo.',
        );
        this.setStatus(
          'erro',
          'Sessão encerrada no celular. Apague data/whatsapp-auth e reinicie para parear de novo.',
        );
        return;
      }

      this.setStatus('erro', 'Conexão caiu. Tentando reconectar...');
      this.logger.warn(
        `Conexão com o WhatsApp caiu${codigo !== undefined ? ` (código ${codigo})` : ''}. Reconectando...`,
      );
      this.agendarReconexao();
    }
  }

  /** Reconexão com espera crescente, para não martelar os servidores. */
  private agendarReconexao(): void {
    if (this.parado) {
      return;
    }
    this.tentativa += 1;
    const esperaMs = Math.min(30_000, 2_000 * this.tentativa);
    this.logger.info(`Nova tentativa de conexão em ${Math.round(esperaMs / 1000)}s.`);

    const timer = setTimeout(() => {
      if (!this.parado) {
        void this.connect();
      }
    }, esperaMs);
    // Não segura o processo aberto no encerramento.
    timer.unref?.();
  }

  /** Encerra a conexão de forma organizada. */
  stop(): void {
    this.parado = true;
    try {
      this.socket?.end(undefined);
    } catch (error) {
      this.logger.warn('Falha ao encerrar a conexão do WhatsApp.', error);
    }
    this.socket = null;
    this.setStatus('desligado', 'Desligado.');
  }
}
