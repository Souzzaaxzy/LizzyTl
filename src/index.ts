/**
 * Ponto de entrada da 𝐋𝐢𝐳𝐳𝐲 𝐝𝐨 𝐩𝐫𝐢𝐯𝐲.
 *
 * Responsabilidades desta etapa:
 * - Carregar .env e validar a configuração obrigatória.
 * - Preparar a persistência local (usuários e cache de mídia).
 * - Registrar comandos e callbacks do Telegram.
 * - Iniciar o bot e tratar falhas/encerramento de forma organizada.
 *
 * A conexão do WhatsApp é independente e não é iniciada aqui.
 */

import { ConfigError, loadConfig } from './config/config';
import { PROJECT_ROOT, loadEnvFile } from './config/env';
import { createLogger } from './core/logger';
import { MediaCache } from './data/media-cache';
import { UserStore } from './data/user-store';
import { registerHelpCommand } from './telegram/commands/help';
import { publishBotCommands } from './telegram/commands/publish-commands';
import { registerStartCommand } from './telegram/commands/start';
import { createBot } from './telegram/client';
import { registerCallbackHandler } from './telegram/handlers/callback-handler';
import { registerMessageHandler } from './telegram/handlers/message-handler';
import { getWhatsAppIntegrationStatus } from './whatsapp/client';

async function main(): Promise<void> {
  // Carrega o .env a partir da raiz do projeto, e não do diretório atual.
  const envFile = loadEnvFile();

  let config;
  try {
    config = loadConfig({
      projectRoot: PROJECT_ROOT,
      envFilePath: envFile.path,
      envFileExists: envFile.exists,
    });
  } catch (error) {
    if (error instanceof ConfigError) {
      // Mensagem clara para o operador; o token nunca é impresso.
      console.error(error.message);
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  const logger = createLogger(config.logLevel);

  const whatsapp = getWhatsAppIntegrationStatus();
  logger.info(`Estado da integração com WhatsApp: ${whatsapp.state} — ${whatsapp.summary}`);

  const users = new UserStore({
    dataDir: config.dataDir,
    logger,
    ownerId: config.ownerTelegramId,
  });
  const mediaCache = new MediaCache(config.dataDir, logger);

  const bot = createBot({ token: config.telegramBotToken, logger });

  // Ordem importa: comandos e callbacks primeiro, e a resposta genérica a
  // mensagens por último, para ela só tratar o que ninguém mais tratou.
  registerStartCommand(bot, { config, logger, users, mediaCache });
  registerHelpCommand(bot, { logger });
  registerCallbackHandler(bot, { logger, users });
  registerMessageHandler(bot, { logger });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Encerrando após ${signal}...`);
    try {
      bot.stop(signal);
    } catch (error) {
      logger.warn('Falha ao encerrar o bot de forma limpa.', error);
    }
    process.exit(0);
  };

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      void shutdown(signal);
    });
  }

  process.on('unhandledRejection', (reason) => {
    logger.error('Promessa rejeitada sem tratamento.', reason);
  });

  process.on('uncaughtException', (error) => {
    logger.error('Exceção não capturada.', error);
  });

  try {
    // O callback onLaunch é disparado quando o getMe inicial conclui com
    // sucesso; launch() só resolve quando o polling é encerrado.
    await bot.launch({}, () => {
      logger.info('Bot do Telegram em execução.');
      // Publica a lista de comandos para o menu "/" do Telegram.
      void publishBotCommands(bot, logger);
    });
  } catch (error) {
    logger.error(
      'Não foi possível iniciar o bot. Verifique o token em .env e a conexão com a internet.',
      error,
    );
    process.exitCode = 1;
  }
}

void main();
