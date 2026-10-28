/**
 * Configuração central do projeto.
 *
 * Regras de segurança aplicadas aqui:
 * - O token nunca é impresso nem incluído em mensagens de erro.
 * - Variáveis obrigatórias são validadas na inicialização com mensagem clara.
 * - O caminho da mídia é configurável por ambiente, sem tocar na lógica do /start.
 */

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { isLogLevel, type LogLevel } from '../core/logger.js';

/** Raiz do projeto, resolvida a partir deste arquivo (não existe __dirname em ESM). */
const PROJECT_ROOT_FROM_MODULE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

export interface Config {
  /** Token do bot do Telegram (obrigatório). */
  telegramBotToken: string;
  /** Caminho da mídia do menu, relativo à raiz do projeto ou absoluto. */
  startMediaPath: string;
  /** Nível de log efetivo. */
  logLevel: LogLevel;
  /** Diretório usado para dados locais privados (sessões futuras do WhatsApp). */
  dataDir: string;
  /** ID do dono do bot, quando configurado. Recebe o plano "dono". */
  ownerTelegramId?: number;
  /** Máximo de ações por usuário dentro da janela. */
  rateLimitMax: number;
  /** Tamanho da janela do limite, em segundos. */
  rateLimitWindowSeconds: number;
  /**
   * Número do WhatsApp a parear, com código do país e só dígitos.
   * Quando ausente, o WhatsApp fica desligado — nunca tenta conectar sozinho.
   */
  whatsappNumber?: string;
  /** Código de pareamento de 8 caracteres, no alfabeto aceito pelo WhatsApp. */
  whatsappPairingCode: string;
  /** Onde a sessão autenticada do WhatsApp é gravada. Nunca vai para o Git. */
  whatsappAuthDir: string;
}

/**
 * Código de pareamento padrão da 𝐋𝐢𝐳𝐳𝐲.
 *
 * O WhatsApp só aceita 8 caracteres do alfabeto Crockford Base32
 * (123456789ABCDEFGHJKLMNPQRSTVWXYZ), que não tem I, O, L nem símbolos.
 * Por isso "lizz-ybot" é impossível; L1ZZYB9T é o mais próximo legível.
 */
export const DEFAULT_WHATSAPP_PAIRING_CODE = 'L1ZZYB9T';

export interface LoadConfigOptions {
  env?: NodeJS.ProcessEnv;
  /** Raiz do projeto; permite resolver caminhos relativos de forma portátil. */
  projectRoot?: string;
  /** Caminho onde o .env foi procurado (usado para orientar o operador). */
  envFilePath?: string;
  /** Se o arquivo .env existe (usado para orientar o operador). */
  envFileExists?: boolean;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

const TOKEN_PLACEHOLDER = 'coloque-o-token-do-botfather-aqui';

/** Monta a orientação adequada para cada situação de token ausente. */
export function buildTokenHelp(options: {
  envFilePath: string;
  envFileExists: boolean;
  projectRoot: string;
}): string {
  const { envFilePath, envFileExists, projectRoot } = options;

  const cause = envFileExists
    ? [
        `O arquivo .env foi encontrado em:`,
        `  ${envFilePath}`,
        '',
        'Mas a linha TELEGRAM_BOT_TOKEN está vazia.',
      ]
    : [
        'Nenhum arquivo .env foi encontrado.',
        `Procurado em:`,
        `  ${envFilePath}`,
      ];

  return [
    'TELEGRAM_BOT_TOKEN não foi configurado.',
    '',
    ...cause,
    '',
    'Como resolver:',
    `  1. Entre na pasta do projeto: cd ${projectRoot}`,
    '  2. Se o .env ainda não existir, crie a partir do modelo: cp .env.example .env',
    '  3. Abra o Telegram e fale com o @BotFather.',
    '  4. Envie /newbot (ou /token para um bot existente) e copie o token.',
    '  5. Cole o valor em .env na linha TELEGRAM_BOT_TOKEN=... (sem espaços e sem aspas).',
    '',
    'Formato esperado: TELEGRAM_BOT_TOKEN=<numero-do-bot>:<segredo>',
    'O valor vem inteiro, sem espaços e sem aspas ao redor.',
    '',
    'O arquivo .env não é versionado e o token nunca é exibido nos logs.',
  ].join('\n');
}

/**
 * ID do dono do bot, usado como valor padrão.
 *
 * Fica no código de propósito: é um identificador do proprietário, não um
 * segredo, e assim o plano "Dono" funciona sem depender de configuração. Pode
 * ser sobrescrito por OWNER_TELEGRAM_ID no .env.
 */
export const DEFAULT_OWNER_TELEGRAM_ID = 8072791511;

/**
 * Lê um inteiro positivo do ambiente. Valor ausente, inválido ou não positivo
 * cai no padrão, para uma variável mal preenchida nunca desligar a proteção.
 */
export function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const texto = (raw ?? '').trim();
  if (texto === '') {
    return fallback;
  }
  const valor = Number(texto);
  return Number.isInteger(valor) && valor > 0 ? valor : fallback;
}

/** Resolve o DATA_DIR do ambiente, ancorado na raiz do projeto. */
function config_dataDir(env: NodeJS.ProcessEnv, projectRoot: string): string {
  const bruto = (env.DATA_DIR ?? '').trim() || 'data';
  return path.isAbsolute(bruto) ? bruto : path.resolve(projectRoot, bruto);
}

export function loadConfig(options: LoadConfigOptions = {}): Config {
  const env = options.env ?? process.env;
  const projectRoot = options.projectRoot ?? PROJECT_ROOT_FROM_MODULE;

  const rawToken = (env.TELEGRAM_BOT_TOKEN ?? '').trim();
  if (rawToken.length === 0 || rawToken === TOKEN_PLACEHOLDER) {
    throw new ConfigError(
      buildTokenHelp({
        envFilePath: options.envFilePath ?? path.join(projectRoot, '.env'),
        envFileExists: options.envFileExists ?? false,
        projectRoot,
      }),
    );
  }

  const rawMediaPath = (env.START_MEDIA_PATH ?? env.START_GIF_PATH ?? '').trim() || 'assets/start.mp4';
  const rawLogLevel = (env.LOG_LEVEL ?? '').trim().toLowerCase();
  const logLevel: LogLevel = isLogLevel(rawLogLevel) ? rawLogLevel : 'info';
  const dataDir = config_dataDir(env, projectRoot);
  const rawWhatsappNumber = (env.WHATSAPP_NUMBER ?? '').trim();
  // Aceita só dígitos: o WhatsApp espera o número sem +, espaço ou traço.
  const whatsappNumber = rawWhatsappNumber.replace(/\D/g, '');
  const rawPairingCode = (env.WHATSAPP_PAIRING_CODE ?? '').trim().toUpperCase();
  const whatsappPairingCode = rawPairingCode === '' ? DEFAULT_WHATSAPP_PAIRING_CODE : rawPairingCode;
  const whatsappAuthDir = path.resolve(config_dataDir(env, projectRoot), 'whatsapp-auth');
  const rateLimitMax = parsePositiveInt(env.RATE_LIMIT_MAX, 20);
  const rateLimitWindowSeconds = parsePositiveInt(env.RATE_LIMIT_WINDOW_SECONDS, 60);
  const rawOwnerId = (env.OWNER_TELEGRAM_ID ?? '').trim();
  const parsedOwnerId = rawOwnerId === '' ? DEFAULT_OWNER_TELEGRAM_ID : Number(rawOwnerId);
  const ownerTelegramId =
    Number.isInteger(parsedOwnerId) && parsedOwnerId > 0 ? parsedOwnerId : undefined;

  return {
    telegramBotToken: rawToken,
    startMediaPath: path.isAbsolute(rawMediaPath)
      ? rawMediaPath
      : path.resolve(projectRoot, rawMediaPath),
    logLevel,
    dataDir,
    ownerTelegramId,
    rateLimitMax,
    rateLimitWindowSeconds,
    whatsappNumber: whatsappNumber === '' ? undefined : whatsappNumber,
    whatsappPairingCode,
    whatsappAuthDir,
  };
}
