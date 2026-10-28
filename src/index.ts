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

import { ConfigError, loadConfig } from './config/config.js';
import { PROJECT_ROOT, loadEnvFile } from './config/env.js';
import { createLogger } from './core/logger.js';
import { RateLimiter } from './core/rate-limiter.js';
import { MediaCache } from './data/media-cache.js';
import { UserStore } from './data/user-store.js';
import { registerHelpCommand } from './telegram/commands/help.js';
import { publishBotCommands } from './telegram/commands/publish-commands.js';
import { registerStartCommand } from './telegram/commands/start.js';
import { createBot } from './telegram/client.js';
import { registerCallbackHandler } from './telegram/handlers/callback-handler.js';
import { registerMessageHandler } from './telegram/handlers/message-handler.js';
import { registerRateLimit } from './telegram/handlers/rate-limit.js';
import { WhatsappConfigStore } from './data/whatsapp-config-store.js';
import { PendingActions } from './telegram/state/pending-action.js';
import { WhatsAppClient } from './whatsapp/client.js';

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

  // O número do WhatsApp é informado pelo dono no próprio Telegram, então fica
  // em disco para sobreviver ao reinício.
  const whatsappStore = new WhatsappConfigStore(config.dataDir, logger);
  const pendingActions = new PendingActions();

  // O WhatsApp é independente do Telegram: sobe em paralelo e uma falha aqui
  // não impede o bot do Telegram de funcionar.
  const whatsapp = new WhatsAppClient({
    config,
    logger,
    store: whatsappStore,
    // O código de pareamento é enviado ao dono no chat, não só no log.
    onPairingCode: (codigo) => {
      const dono = config.ownerTelegramId;
      if (dono === undefined) {
        return;
      }
      void bot.telegram
        .sendMessage(
          dono,
          [
            '📱 𝐂𝐨́𝐝𝐢𝐠𝐨 𝐝𝐞 𝐩𝐚𝐫𝐞𝐚𝐦𝐞𝐧𝐭𝐨 𝐝𝐨 𝐖𝐡𝐚𝐭𝐬𝐀𝐩𝐩',
            '',
            `♛ <code>${codigo}</code>`,
            '',
            '✦ 𝐍𝐨 𝐜𝐞𝐥𝐮𝐥𝐚𝐫: WhatsApp → Aparelhos conectados → Conectar aparelho →',
            '  Conectar com número de telefone.',
            '',
            '♛ 𝐎 𝐜𝐨́𝐝𝐢𝐠𝐨 𝐞𝐱𝐩𝐢𝐫𝐚 𝐞𝐦 𝐜𝐞𝐫𝐜𝐚 𝐝𝐞 𝟏 𝐦𝐢𝐧𝐮𝐭𝐨. Se expirar, toque em',
            '  Conectar de novo.',
          ].join('\n'),
          { parse_mode: 'HTML' },
        )
        .catch((error: unknown) => {
          logger.error('Falha ao enviar o código de pareamento no Telegram.', error);
        });
    },
  });

  const users = new UserStore({
    dataDir: config.dataDir,
    logger,
    ownerId: config.ownerTelegramId,
  });
  const mediaCache = new MediaCache(config.dataDir, logger);

  const limiter = new RateLimiter({
    limit: config.rateLimitMax,
    windowMs: config.rateLimitWindowSeconds * 1000,
  });

  const bot = createBot({ token: config.telegramBotToken, logger });

  // O limite vem primeiro: barra o abuso antes de qualquer trabalho caro.
  registerRateLimit(bot, { limiter, logger, users });

  // Ordem importa: comandos e callbacks primeiro, e a resposta genérica a
  // mensagens por último, para ela só tratar o que ninguém mais tratou.
  registerStartCommand(bot, { config, logger, users, mediaCache, whatsapp });
  registerHelpCommand(bot, { logger });
  registerCallbackHandler(bot, { logger, users, whatsapp, pendingActions });
  registerMessageHandler(bot, { logger, users, whatsapp, pendingActions });

  // Limpeza periódica do mapa do limitador, para ele não crescer sem limite.
  // unref() para o timer não segurar o processo aberto no encerramento.
  const pruneTimer = setInterval(() => limiter.prune(), 10 * 60 * 1000);
  pruneTimer.unref();

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Encerrando após ${signal}...`);
    clearInterval(pruneTimer);
    // Encerra as duas conexões de forma organizada, uma não depende da outra.
    whatsapp.stop();
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

    // Só inicia o WhatsApp depois que o Telegram subiu, e sem await: uma falha
    // aqui não pode impedir o Telegram de rodar.
    void whatsapp.start().then(() => {
      const status = whatsapp.getStatus();
      logger.info(`Estado do WhatsApp: ${status.state} — ${status.summary}`);
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
