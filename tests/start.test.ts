import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, before, describe, it } from 'node:test';

import { Telegram, type Telegraf } from 'telegraf';

import { createLogger } from '../src/core/logger';
import { registerStartCommand, resolveDisplayName } from '../src/telegram/commands/start';
import { createBot } from '../src/telegram/client';
import { registerCallbackHandler } from '../src/telegram/handlers/callback-handler';
import { MENU_CALLBACKS } from '../src/telegram/menus/main-menu';

interface RecordedCall {
  method: string;
  payload: Record<string, unknown>;
}

/** GIF 1x1 mínimo (GIF89a), usado apenas como fixture temporária de teste. */
const MINIMAL_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

const silentLogger = createLogger('error');

/**
 * Substitui a chamada HTTP real do Telegram por um gravador, sem tocar na rede.
 *
 * O Telegraf cria uma instância de Telegram por atualização, então o stub é
 * aplicado no protótipo da classe para valer também para `ctx.telegram`.
 * O protótipo original é restaurado por `restore()`.
 */
function instrument(): { calls: RecordedCall[]; restore: () => void } {
  const calls: RecordedCall[] = [];
  const proto = Telegram.prototype as unknown as {
    callApi: (method: string, payload?: Record<string, unknown>) => Promise<unknown>;
  };
  const original = proto.callApi;

  proto.callApi = function patchedCallApi(
    this: unknown,
    method: string,
    payload?: Record<string, unknown>,
  ): Promise<unknown> {
    calls.push({ method: String(method), payload: payload ?? {} });
    if (method === 'getMe') {
      return Promise.resolve({ id: 1, is_bot: true, first_name: 'Lizzy', username: 'lizzy_bot' });
    }
    return Promise.resolve(true);
  };

  return {
    calls,
    restore: () => {
      proto.callApi = original;
    },
  };
}

let activeStub: { calls: RecordedCall[]; restore: () => void } | null = null;

/** Ativa o stub e garante a restauração do protótipo ao final de cada teste. */
function stubTelegram(): RecordedCall[] {
  activeStub = instrument();
  return activeStub.calls;
}

afterEach(() => {
  activeStub?.restore();
  activeStub = null;
});

function startUpdate(updateId: number, from: { id: number; username?: string; first_name?: string }) {
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: Math.floor(Date.now() / 1000),
      chat: { id: from.id, type: 'private' as const },
      from: { id: from.id, is_bot: false, ...from },
      text: '/start',
      entities: [{ type: 'bot_command' as const, offset: 0, length: 6 }],
    },
  };
}

function callbackUpdate(updateId: number, data: string) {
  return {
    update_id: updateId,
    callback_query: {
      id: String(updateId),
      from: { id: 42, is_bot: false, first_name: 'Teste' },
      chat_instance: 'ci',
      data,
      message: {
        message_id: 1,
        date: Math.floor(Date.now() / 1000),
        chat: { id: 42, type: 'private' as const },
        from: { id: 1, is_bot: true, first_name: 'Lizzy' },
      },
    },
  };
}

describe('resolveDisplayName', () => {
  it('prefere o username', () => {
    assert.equal(resolveDisplayName({ username: 'lizzy', first_name: 'Ana' }), '@lizzy');
  });

  it('usa o primeiro nome quando não há username', () => {
    assert.equal(resolveDisplayName({ first_name: 'Ana' }), 'Ana');
  });

  it('nunca devolve "@usuario" nem string vazia', () => {
    assert.equal(resolveDisplayName({}), 'usuário');
    assert.equal(resolveDisplayName(undefined), 'usuário');
    assert.equal(resolveDisplayName({ username: '   ' }), 'usuário');
    assert.notEqual(resolveDisplayName({}), '@usuario');
  });
});

describe('comando /start (sem GIF disponível)', () => {
  it('envia legenda e os quatro botões em UMA única mensagem', async () => {
    const bot = createBot({ token: '111:TESTE', logger: silentLogger });
    registerStartCommand(bot, {
      config: {
        startGifPath: path.join(os.tmpdir(), 'lizzy-inexistente.gif'),
      },
      logger: silentLogger,
    });
    const calls = stubTelegram();

    await bot.handleUpdate(startUpdate(1, { id: 7, username: 'souzza' }));

    const sends = calls.filter((call) => call.method !== 'getMe');
    assert.equal(sends.length, 1, 'deve enviar exatamente uma mensagem');
    const [send] = sends;
    assert.equal(send?.method, 'sendMessage');
    assert.match(String(send?.payload.text), /@souzza/);
    const markup = send?.payload.reply_markup as { inline_keyboard: unknown[][] };
    assert.equal(markup.inline_keyboard.length, 2);
    assert.equal(markup.inline_keyboard.flat().length, 4);
  });

  it('usa o primeiro nome quando o usuário não tem username', async () => {
    const bot = createBot({ token: '111:TESTE', logger: silentLogger });
    registerStartCommand(bot, {
      config: {
        startGifPath: path.join(os.tmpdir(), 'lizzy-inexistente.gif'),
      },
      logger: silentLogger,
    });
    const calls = stubTelegram();

    await bot.handleUpdate(startUpdate(2, { id: 8, first_name: 'Bruno' }));

    const send = calls.find((call) => call.method === 'sendMessage');
    assert.match(String(send?.payload.text), /Bruno/);
    assert.equal(String(send?.payload.text).includes('@usuario'), false);
  });
});

describe('comando /start (com GIF disponível)', () => {
  let tmpDir: string;
  let gifPath: string;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lizzy-gif-'));
    gifPath = path.join(tmpDir, 'start.gif');
    fs.writeFileSync(gifPath, MINIMAL_GIF);
    // O Telegraf abre o arquivo de forma preguiçosa; remover no fim do processo
    // evita corrida entre a leitura do stream e a limpeza do diretório.
    process.once('exit', () => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  it('envia a mídia em loop (sendAnimation) com legenda e botões na MESMA mensagem', async () => {
    const bot = createBot({ token: '111:TESTE', logger: silentLogger });
    registerStartCommand(bot, {
      config: { startGifPath: gifPath },
      logger: silentLogger,
    });
    const calls = stubTelegram();

    await bot.handleUpdate(startUpdate(3, { id: 9, username: 'gif_user' }));

    const sends = calls.filter((call) => call.method !== 'getMe');
    assert.equal(sends.length, 1, 'mídia, legenda e botões devem ir em uma única mensagem');
    assert.equal(sends[0]?.method, 'sendAnimation');
    assert.match(String(sends[0]?.payload.caption), /@gif_user/);
    const markup = sends[0]?.payload.reply_markup as { inline_keyboard: unknown[][] };
    assert.equal(markup.inline_keyboard.flat().length, 4);
  });

  it('envia a mídia com o nome real do arquivo', async () => {
    const bot = createBot({ token: '111:TESTE', logger: silentLogger });
    registerStartCommand(bot, { config: { startGifPath: gifPath }, logger: silentLogger });
    const calls = stubTelegram();

    await bot.handleUpdate(startUpdate(4, { id: 11, username: 'midia' }));

    const anim = calls.find((call) => call.method === 'sendAnimation')?.payload
      .animation as { filename?: string } | undefined;
    assert.ok(anim, 'deve enviar como animação');
    assert.equal(anim.filename, 'start.gif');
  });

});

describe('callbacks do menu', () => {
  it('responde cada callback válido sem derrubar o processo', async () => {
    const bot = createBot({ token: '111:TESTE', logger: silentLogger });
    registerCallbackHandler(bot, { logger: silentLogger });
    const calls = stubTelegram();

    let updateId = 10;
    for (const callback of Object.values(MENU_CALLBACKS)) {
      calls.length = 0;
      await bot.handleUpdate(callbackUpdate(updateId++, callback));
      assert.ok(
        calls.some((call) => call.method === 'answerCallbackQuery'),
        `callback ${callback} deve ser respondido`,
      );
      assert.ok(
        calls.some((call) => call.method === 'sendMessage'),
        `callback ${callback} deve produzir uma resposta`,
      );
    }
  });

  it('trata callback desconhecido com aviso, sem lançar erro', async () => {
    const bot = createBot({ token: '111:TESTE', logger: silentLogger });
    registerCallbackHandler(bot, { logger: silentLogger });
    const calls = stubTelegram();

    await bot.handleUpdate(callbackUpdate(99, 'menu_inexistente'));

    const answered = calls.find((call) => call.method === 'answerCallbackQuery');
    assert.ok(answered, 'o Telegram precisa receber uma resposta');
    assert.equal(
      calls.some((call) => call.method === 'sendMessage'),
      false,
    );
  });

  it('responde callbacks fora do prefixo do menu', async () => {
    const bot = createBot({ token: '111:TESTE', logger: silentLogger });
    registerCallbackHandler(bot, { logger: silentLogger });
    const calls = stubTelegram();

    await bot.handleUpdate(callbackUpdate(100, 'outro_prefixo'));

    assert.ok(calls.some((call) => call.method === 'answerCallbackQuery'));
  });
});
