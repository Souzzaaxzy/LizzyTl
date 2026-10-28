/**
 * Ponto de entrada da 𝐋𝐢𝐳𝐳𝐲 𝐝𝐨 𝐩𝐫𝐢𝐯𝐲.
 *
 * Responsabilidades:
 * - Carregar .env e validar a configuração obrigatória.
 * - Preparar a persistência local (usuários, cache de mídia, sessões).
 * - Registrar comandos e callbacks do Telegram.
 * - Subir as sessões de WhatsApp de cada usuário.
 * - Tratar falhas e encerramento de forma organizada.
 *
 * O Telegram e o WhatsApp são independentes: uma falha em um não derruba o
 * outro. O mesmo vale entre as sessões de WhatsApp dos diferentes usuários.
 */

import { ConfigError, loadConfig } from './config/config.js';
import { PROJECT_ROOT, loadEnvFile } from './config/env.js';
import { createLogger } from './core/logger.js';
import { RateLimiter } from './core/rate-limiter.js';
import { MediaCache } from './data/media-cache.js';
import { UserStore } from './data/user-store.js';
import { WhatsappSessionStore } from './data/whatsapp-session-store.js';
import { registerHelpCommand } from './telegram/commands/help.js';
import { publishBotCommands } from './telegram/commands/publish-commands.js';
import { registerStartCommand } from './telegram/commands/start.js';
import { createBot } from './telegram/client.js';
import { registerCallbackHandler } from './telegram/handlers/callback-handler.js';
import { registerMessageHandler } from './telegram/handlers/message-handler.js';
import { registerRateLimit } from './telegram/handlers/rate-limit.js';
import {
  buildPairingMessage,
  buildStateMessage,
} from './telegram/messages/notifications.js';
import { PendingActions } from './telegram/state/pending-action.js';
import { WhatsAppManager } from './whatsapp/manager.js';

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
  // Cada usuário tem a própria sessão de WhatsApp, isolada em data/.
  const whatsappStore = new WhatsappSessionStore(config.dataDir, logger);
  const pendingActions = new PendingActions();

  const bot = createBot({ token: config.telegramBotToken, logger });

  // O WhatsApp é independente do Telegram: uma falha aqui não impede o bot do
  // Telegram de funcionar. O código de pareamento vai para o chat do próprio
  // usuário dono da sessão, nunca para outro.
  const whatsapp = new WhatsAppManager({
    store: whatsappStore,
    logger,
    pairingCode: config.whatsappPairingCode,
    maxSessions: config.whatsappMaxSessions,
    onPairingCode: (userId, codigo) => {
      void bot.telegram
        .sendMessage(userId, buildPairingMessage(codigo), { parse_mode: 'HTML' })
        .catch((error: unknown) => {
          logger.error(
            `Falha ao enviar o código de pareamento ao usuário ${userId}.`,
            error,
          );
        });
    },

    // Avisa no chat quando a sessão conecta, cai ou é encerrada. Sem isso o
    // usuário só descobriria abrindo a tela para conferir.
    onStateChange: (userId, state, detalhe) => {
      const mensagem = buildStateMessage(state, detalhe);
      if (mensagem === null) {
        return;
      }
      void bot.telegram
        .sendMessage(userId, mensagem, { parse_mode: 'HTML' })
        .catch((error: unknown) => {
          logger.error(
            `Falha ao avisar o usuário ${userId} sobre o estado do WhatsApp.`,
            error,
          );
        });
    },
  });

  // O limite vem primeiro: barra o abuso antes de qualquer trabalho caro.
  registerRateLimit(bot, { limiter, logger, users });

  // Ordem importa: comandos e callbacks primeiro, e a resposta genérica a
  // mensagens por último, para ela só tratar o que ninguém mais tratou.
  registerStartCommand(bot, { config, logger, users, mediaCache, whatsapp });
  registerHelpCommand(bot, { logger });
  registerCallbackHandler(bot, { logger, users, whatsapp, whatsappFull: whatsapp, pendingActions });
  registerMessageHandler(bot, { logger, users, whatsapp, pendingActions });

  // Limpeza periódica do mapa do limitador, para ele não crescer sem limite.
  // unref() para o timer não segurar o processo aberto no encerramento.
  const pruneTimer = setInterval(() => limiter.prune(), 10 * 60 * 1000);
  pruneTimer.unref();

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Encerrando após ${signal}...`);
    clearInterval(pruneTimer);
    // Encerra as duas conexões de forma organizada, uma não depende da outra.
    whatsapp.stopAll();
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

    // Retoma as sessões de WhatsApp depois que o Telegram subiu, e sem await:
    // uma falha aqui não pode impedir o Telegram de rodar.
    void whatsapp.startAll().then(() => {
      logger.info(`Sessões de WhatsApp ativas: ${whatsapp.activeCount()}.`);
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
