/**
 * Logger mínimo e sem dependências externas.
 *
 * Motivo de existir: o projeto precisa registrar falhas de conexão e erros
 * inesperados sem adicionar bibliotecas incompatíveis com o Termux. Os níveis
 * seguem a variável de ambiente LOG_LEVEL (error > warn > info > debug).
 */

export const LOG_LEVELS = ['error', 'warn', 'info', 'debug'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

export function isLogLevel(value: string): value is LogLevel {
  return (LOG_LEVELS as readonly string[]).includes(value);
}

export interface Logger {
  error(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
  child(scope: string): Logger;
}

function timestamp(): string {
  return new Date().toISOString();
}

export function createLogger(level: LogLevel = 'info', scope = 'lizzy'): Logger {
  const minWeight = LEVEL_WEIGHT[level];

  const write = (entryLevel: LogLevel, message: string, args: unknown[]): void => {
    if (LEVEL_WEIGHT[entryLevel] > minWeight) {
      return;
    }
    const line = `${timestamp()} [${entryLevel.toUpperCase()}] [${scope}] ${message}`;
    const stream = entryLevel === 'error' ? console.error : console.log;
    stream(line, ...args);
  };

  return {
    error: (message, ...args) => write('error', message, args),
    warn: (message, ...args) => write('warn', message, args),
    info: (message, ...args) => write('info', message, args),
    debug: (message, ...args) => write('debug', message, args),
    child: (childScope: string) => createLogger(level, `${scope}:${childScope}`),
  };
}
