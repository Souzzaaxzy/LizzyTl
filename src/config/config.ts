/**
 * Configuração central do projeto.
 *
 * Regras de segurança aplicadas aqui:
 * - O token nunca é impresso nem incluído em mensagens de erro.
 * - Variáveis obrigatórias são validadas na inicialização com mensagem clara.
 * - O caminho do GIF é configurável por ambiente, sem tocar na lógica do /start.
 */

import * as path from 'node:path';

import { isLogLevel, type LogLevel } from '../core/logger';

export interface Config {
  /** Token do bot do Telegram (obrigatório). */
  telegramBotToken: string;
  /** Caminho do GIF do menu, relativo à raiz do projeto ou absoluto. */
  startGifPath: string;
  /** Nível de log efetivo. */
  logLevel: LogLevel;
  /** Diretório usado para dados locais privados (sessões futuras do WhatsApp). */
  dataDir: string;
}

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

export function loadConfig(options: LoadConfigOptions = {}): Config {
  const env = options.env ?? process.env;
  const projectRoot = options.projectRoot ?? path.resolve(__dirname, '..', '..');

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

  const rawGifPath = (env.START_GIF_PATH ?? '').trim() || 'assets/start.gif';
  const rawLogLevel = (env.LOG_LEVEL ?? '').trim().toLowerCase();
  const logLevel: LogLevel = isLogLevel(rawLogLevel) ? rawLogLevel : 'info';
  const dataDir = (env.DATA_DIR ?? '').trim() || 'data';

  return {
    telegramBotToken: rawToken,
    startGifPath: path.isAbsolute(rawGifPath) ? rawGifPath : path.resolve(projectRoot, rawGifPath),
    logLevel,
    dataDir: path.isAbsolute(dataDir) ? dataDir : path.resolve(projectRoot, dataDir),
  };
}
