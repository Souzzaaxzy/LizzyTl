import * as assert from 'node:assert/strict';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import {
  ConfigError,
  DEFAULT_OWNER_TELEGRAM_ID,
  loadConfig,
} from '../src/config/config.js';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('loadConfig', () => {
  it('falha com mensagem clara quando o token está ausente', () => {
    assert.throws(
      () => loadConfig({ env: {}, projectRoot: PROJECT_ROOT }),
      (error: unknown) => {
        assert.ok(error instanceof ConfigError);
        assert.match(error.message, /TELEGRAM_BOT_TOKEN não foi configurado/);
        assert.match(error.message, /\.env\.example/);
        return true;
      },
    );
  });

  it('trata o placeholder do .env.example como token ausente', () => {
    assert.throws(
      () =>
        loadConfig({
          env: { TELEGRAM_BOT_TOKEN: 'coloque-o-token-do-botfather-aqui' },
          projectRoot: PROJECT_ROOT,
        }),
      ConfigError,
    );
  });

  it('usa o caminho padrão assets/start.mp4 quando START_MEDIA_PATH não é definido', () => {
    const config = loadConfig({
      env: { TELEGRAM_BOT_TOKEN: '123:ABC' },
      projectRoot: PROJECT_ROOT,
    });
    assert.equal(config.startMediaPath, path.join(PROJECT_ROOT, 'assets', 'start.mp4'));
    assert.equal(config.logLevel, 'info');
  });

  it('permite configurar o caminho da mídia sem alterar a lógica do comando', () => {
    const config = loadConfig({
      env: { TELEGRAM_BOT_TOKEN: '123:ABC', START_MEDIA_PATH: 'assets/outro.mp4', LOG_LEVEL: 'debug' },
      projectRoot: PROJECT_ROOT,
    });
    assert.equal(config.startMediaPath, path.join(PROJECT_ROOT, 'assets', 'outro.mp4'));
    assert.equal(config.logLevel, 'debug');
  });

  it('respeita caminhos absolutos e ignora níveis de log inválidos', () => {
    const absolute = path.resolve(PROJECT_ROOT, 'assets', 'start.mp4');
    const config = loadConfig({
      env: { TELEGRAM_BOT_TOKEN: '123:ABC', START_MEDIA_PATH: absolute, LOG_LEVEL: 'verboso' },
      projectRoot: PROJECT_ROOT,
    });
    assert.equal(config.startMediaPath, absolute);
    assert.equal(config.logLevel, 'info');
  });

  it('não expõe nenhum valor de token na mensagem de erro', () => {
    try {
      loadConfig({ env: {}, projectRoot: PROJECT_ROOT });
      assert.fail('deveria ter lançado ConfigError');
    } catch (error) {
      assert.ok(error instanceof ConfigError);
      // Um token do Telegram tem o formato <dígitos>:<segredo>.
      assert.equal(/\d{6,}:[A-Za-z0-9_-]{10,}/.test(error.message), false);
      assert.match(error.message, /@BotFather/);
    }
  });

  it('informa o caminho verificado quando o .env não existe', () => {
    try {
      loadConfig({
        env: {},
        projectRoot: PROJECT_ROOT,
        envFilePath: path.join(PROJECT_ROOT, '.env'),
        envFileExists: false,
      });
      assert.fail('deveria ter lançado ConfigError');
    } catch (error) {
      assert.ok(error instanceof ConfigError);
      assert.match(error.message, /Nenhum arquivo \.env foi encontrado/);
      assert.match(error.message, /\.env/);
    }
  });

  it('distingue o caso em que o .env existe mas o token está vazio', () => {
    try {
      loadConfig({
        env: { TELEGRAM_BOT_TOKEN: '' },
        projectRoot: PROJECT_ROOT,
        envFilePath: path.join(PROJECT_ROOT, '.env'),
        envFileExists: true,
      });
      assert.fail('deveria ter lançado ConfigError');
    } catch (error) {
      assert.ok(error instanceof ConfigError);
      assert.match(error.message, /arquivo \.env foi encontrado/);
      assert.match(error.message, /está vazia/);
      assert.equal(error.message.includes('Nenhum arquivo'), false);
    }
  });

  it('usa o ID do dono definido no código quando o .env não define', () => {
    const config = loadConfig({
      env: { TELEGRAM_BOT_TOKEN: '123:ABC' },
      projectRoot: PROJECT_ROOT,
    });
    assert.equal(config.ownerTelegramId, DEFAULT_OWNER_TELEGRAM_ID);
  });

  it('permite sobrescrever o dono pelo .env', () => {
    const config = loadConfig({
      env: { TELEGRAM_BOT_TOKEN: '123:ABC', OWNER_TELEGRAM_ID: '42' },
      projectRoot: PROJECT_ROOT,
    });
    assert.equal(config.ownerTelegramId, 42);
  });

  it('ignora OWNER_TELEGRAM_ID inválido', () => {
    const config = loadConfig({
      env: { TELEGRAM_BOT_TOKEN: '123:ABC', OWNER_TELEGRAM_ID: 'abc' },
      projectRoot: PROJECT_ROOT,
    });
    assert.equal(config.ownerTelegramId, undefined);
  });

  it('orienta com o caminho do projeto e o formato esperado do token', () => {
    try {
      loadConfig({ env: {}, projectRoot: PROJECT_ROOT, envFileExists: false });
      assert.fail('deveria ter lançado ConfigError');
    } catch (error) {
      assert.ok(error instanceof ConfigError);
      assert.match(error.message, /cd .*project/);
      assert.match(error.message, /TELEGRAM_BOT_TOKEN=<numero-do-bot>:<segredo>/);
    }
  });
});
