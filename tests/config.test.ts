import * as assert from 'node:assert/strict';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import { ConfigError, loadConfig } from '../src/config/config';

const PROJECT_ROOT = path.resolve(__dirname, '..');

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

  it('usa o caminho padrão assets/start.gif quando START_GIF_PATH não é definido', () => {
    const config = loadConfig({
      env: { TELEGRAM_BOT_TOKEN: '123:ABC' },
      projectRoot: PROJECT_ROOT,
    });
    assert.equal(config.startGifPath, path.join(PROJECT_ROOT, 'assets', 'start.gif'));
    assert.equal(config.logLevel, 'info');
  });

  it('permite configurar o caminho do GIF sem alterar a lógica do comando', () => {
    const config = loadConfig({
      env: { TELEGRAM_BOT_TOKEN: '123:ABC', START_GIF_PATH: 'assets/outro.gif', LOG_LEVEL: 'debug' },
      projectRoot: PROJECT_ROOT,
    });
    assert.equal(config.startGifPath, path.join(PROJECT_ROOT, 'assets', 'outro.gif'));
    assert.equal(config.logLevel, 'debug');
  });

  it('respeita caminhos absolutos e ignora níveis de log inválidos', () => {
    const absolute = path.resolve(PROJECT_ROOT, 'assets', 'start.gif');
    const config = loadConfig({
      env: { TELEGRAM_BOT_TOKEN: '123:ABC', START_GIF_PATH: absolute, LOG_LEVEL: 'verboso' },
      projectRoot: PROJECT_ROOT,
    });
    assert.equal(config.startGifPath, absolute);
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
});
