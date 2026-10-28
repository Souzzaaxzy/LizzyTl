import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, before, describe, it } from 'node:test';

import { Telegram, type Telegraf } from 'telegraf';

import { createLogger } from '../src/core/logger';
import { MediaCache } from '../src/data/media-cache';
import { UserStore } from '../src/data/user-store';
import { registerHelpCommand } from '../src/telegram/commands/help';
import { publishBotCommands } from '../src/telegram/commands/publish-commands';
import { registerStartCommand } from '../src/telegram/commands/start';
import { createBot } from '../src/telegram/client';
import { registerCallbackHandler } from '../src/telegram/handlers/callback-handler';
import { registerMessageHandler } from '../src/telegram/handlers/message-handler';
import { BOT_COMMANDS, CALLBACKS, resolveDisplayName } from '../src/telegram/screens/screens';

interface RecordedCall {
  method: string;
  payload: Record<string, unknown>;
}

/** Cabeçalho mínimo de arquivo MP4, usado apenas como fixture temporária. */
const MINIMAL_MP4 = Buffer.from('00000018667479706d703432000000006d70343269736f6d', 'hex');

const silentLogger = createLogger('error');

/**
 * Substitui a chamada HTTP real do Telegram por um gravador, sem tocar na rede.
 *
 * O Telegraf cria uma instância de Telegram por atualização, então o stub é
 * aplicado no protótipo da classe para valer também para `ctx.telegram`.
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
    if (method === 'sendAnimation') {
      return Promise.resolve({
        message_id: 10,
        animation: { file_id: 'FILE_ID_123', file_unique_id: 'u1', width: 540, height: 300, duration: 3 },
      });
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

function stubTelegram(): RecordedCall[] {
  activeStub = instrument();
  return activeStub.calls;
}

afterEach(() => {
  activeStub?.restore();
  activeStub = null;
});

let dataDir: string;

function makeStore(ownerId?: number): UserStore {
  return new UserStore({ dataDir, logger: silentLogger, ownerId });
}

function makeCache(): MediaCache {
  return new MediaCache(dataDir, silentLogger);
}

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

function textUpdate(updateId: number, text: string, fromId = 42) {
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: Math.floor(Date.now() / 1000),
      chat: { id: fromId, type: 'private' as const },
      from: { id: fromId, is_bot: false, first_name: 'Teste' },
      text,
    },
  };
}

function callbackUpdate(updateId: number, data: string, fromId = 42) {
  return {
    update_id: updateId,
    callback_query: {
      id: String(updateId),
      from: { id: fromId, is_bot: false, first_name: 'Teste' },
      chat_instance: 'ci',
      data,
      message: {
        message_id: 1,
        date: Math.floor(Date.now() / 1000),
        chat: { id: fromId, type: 'private' as const },
        from: { id: 1, is_bot: true, first_name: 'Lizzy' },
      },
    },
  };
}

before(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lizzy-data-'));
  process.once('exit', () => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });
});

describe('resolveDisplayName', () => {
  it('prefere o username', () => {
    assert.equal(resolveDisplayName(null, { id: 1, username: 'lizzy', first_name: 'Ana' }), '@lizzy');
  });

  it('usa o primeiro nome quando não há username', () => {
    assert.equal(resolveDisplayName(null, { id: 1, first_name: 'Ana' }), 'Ana');
  });

  it('nunca devolve "@usuario" nem string vazia', () => {
    assert.equal(resolveDisplayName(null, { id: 1 }), 'usuário');
    assert.equal(resolveDisplayName(null), 'usuário');
    assert.notEqual(resolveDisplayName(null), '@usuario');
  });
});

describe('UserStore', () => {
  it('cria o registro no primeiro acesso com a data de entrada', () => {
    const store = makeStore();
    const record = store.touch({ id: 9001, username: 'novo', first_name: 'Novo' });
    assert.equal(record.id, 9001);
    assert.equal(record.accessCount, 1);
    assert.equal(record.plan, 'padrao');
    assert.ok(record.firstSeenAt.length > 0);
  });

  it('mantém a data de entrada e incrementa os acessos', () => {
    const store = makeStore();
    const first = store.touch({ id: 9002, username: 'a', first_name: 'A' });
    const second = store.touch({ id: 9002, username: 'a', first_name: 'A' });
    assert.equal(second.firstSeenAt, first.firstSeenAt);
    assert.equal(second.accessCount, 2);
  });

  it('atualiza o username quando o usuário o altera', () => {
    const store = makeStore();
    store.touch({ id: 9003, username: 'antigo', first_name: 'A' });
    const atualizado = store.touch({ id: 9003, username: 'novo', first_name: 'A' });
    assert.equal(atualizado.username, 'novo');
  });

  it('persiste em disco e recarrega', () => {
    const store = makeStore();
    store.touch({ id: 9004, username: 'persistente', first_name: 'P' });
    const recarregado = makeStore().get(9004);
    assert.equal(recarregado?.username, 'persistente');
  });

  it('marca o dono quando o id coincide', () => {
    const store = makeStore(555);
    assert.equal(store.touch({ id: 555, first_name: 'Dono' }).plan, 'dono');
    assert.equal(store.touch({ id: 556, first_name: 'Comum' }).plan, 'padrao');
  });
});

describe('comando /start (com mídia)', () => {
  let mediaPath: string;

  before(() => {
    mediaPath = path.join(dataDir, 'start.mp4');
    fs.writeFileSync(mediaPath, MINIMAL_MP4);
  });

  it('envia mídia, legenda e botões em UMA única mensagem', async () => {
    const bot = createBot({ token: '111:TESTE', logger: silentLogger });
    registerStartCommand(bot, {
      config: { startMediaPath: mediaPath },
      logger: silentLogger,
      users: makeStore(),
      mediaCache: makeCache(),
    });
    const calls = stubTelegram();

    await bot.handleUpdate(startUpdate(1, { id: 8001, username: 'souzza' }));

    const sends = calls.filter((c) => c.method !== 'getMe');
    assert.equal(sends.length, 1, 'deve enviar exatamente uma mensagem');
    assert.equal(sends[0]?.method, 'sendAnimation');
    assert.match(String(sends[0]?.payload.caption), /@souzza/);
    const markup = sends[0]?.payload.reply_markup as { inline_keyboard: unknown[][] };
    assert.equal(markup.inline_keyboard.flat().length, 4);
  });

  it('registra o usuário no primeiro /start', async () => {
    const users = makeStore();
    const bot = createBot({ token: '111:TESTE', logger: silentLogger });
    registerStartCommand(bot, {
      config: { startMediaPath: mediaPath },
      logger: silentLogger,
      users,
      mediaCache: makeCache(),
    });
    stubTelegram();

    await bot.handleUpdate(startUpdate(2, { id: 8002, username: 'registrado', first_name: 'R' }));

    const record = users.get(8002);
    assert.equal(record?.username, 'registrado');
    assert.equal(record?.accessCount, 1);
  });

  it('guarda o file_id e reusa no próximo envio, sem reenviar o arquivo', async () => {
    const cache = makeCache();
    const bot = createBot({ token: '111:TESTE', logger: silentLogger });
    registerStartCommand(bot, {
      config: { startMediaPath: mediaPath },
      logger: silentLogger,
      users: makeStore(),
      mediaCache: cache,
    });
    const calls = stubTelegram();

    await bot.handleUpdate(startUpdate(3, { id: 8003, username: 'cache' }));
    assert.equal(cache.get(mediaPath), 'FILE_ID_123');

    calls.length = 0;
    await bot.handleUpdate(startUpdate(4, { id: 8004, username: 'cache' }));

    const animation = calls.find((c) => c.method === 'sendAnimation')?.payload.animation;
    assert.equal(animation, 'FILE_ID_123', 'o segundo envio deve usar o file_id');
  });
});

describe('comando /start (sem mídia)', () => {
  it('envia legenda e botões sem mídia, sem quebrar', async () => {
    const bot = createBot({ token: '111:TESTE', logger: silentLogger });
    registerStartCommand(bot, {
      config: { startMediaPath: path.join(dataDir, 'inexistente.mp4') },
      logger: silentLogger,
      users: makeStore(),
      mediaCache: makeCache(),
    });
    const calls = stubTelegram();

    await bot.handleUpdate(startUpdate(5, { id: 8005, username: 'sem_media' }));

    const sends = calls.filter((c) => c.method !== 'getMe');
    assert.equal(sends.length, 1);
    assert.equal(sends[0]?.method, 'sendMessage');
    const markup = sends[0]?.payload.reply_markup as { inline_keyboard: unknown[][] };
    assert.equal(markup.inline_keyboard.flat().length, 4);
  });
});

describe('navegação por callbacks', () => {
  it('abre o perfil com os dados do usuário e edita a mensagem', async () => {
    const users = makeStore();
    users.touch({ id: 7001, username: 'perfil', first_name: 'Perfil' });
    const bot = createBot({ token: '111:TESTE', logger: silentLogger });
    registerCallbackHandler(bot, { logger: silentLogger, users });
    const calls = stubTelegram();

    await bot.handleUpdate(callbackUpdate(10, CALLBACKS.MENU_PROFILE, 7001));

    assert.ok(calls.some((c) => c.method === 'answerCallbackQuery'));
    const edit = calls.find((c) => c.method === 'editMessageCaption');
    assert.ok(edit, 'deve editar a mensagem em vez de enviar outra');
    assert.match(String(edit?.payload.caption), /𝐈𝐃: 7001/);
    assert.equal(
      calls.some((c) => c.method === 'sendMessage'),
      false,
      'não deve enviar mensagem nova ao navegar',
    );
  });

  it('responde todos os callbacks de menu sem derrubar o processo', async () => {
    const bot = createBot({ token: '111:TESTE', logger: silentLogger });
    registerCallbackHandler(bot, { logger: silentLogger, users: makeStore() });
    const calls = stubTelegram();

    let id = 20;
    for (const cb of [CALLBACKS.MENU_PROFILE, CALLBACKS.MENU_SETTINGS, CALLBACKS.MENU_WHATSAPP, CALLBACKS.MENU_ABOUT, CALLBACKS.NAV_BACK]) {
      calls.length = 0;
      await bot.handleUpdate(callbackUpdate(id++, cb));
      assert.ok(calls.some((c) => c.method === 'answerCallbackQuery'), `${cb} deve ser respondido`);
    }
  });

  it('trata callback desconhecido sem lançar erro', async () => {
    const bot = createBot({ token: '111:TESTE', logger: silentLogger });
    registerCallbackHandler(bot, { logger: silentLogger, users: makeStore() });
    const calls = stubTelegram();

    await bot.handleUpdate(callbackUpdate(30, 'menu_inexistente'));

    assert.ok(calls.some((c) => c.method === 'answerCallbackQuery'));
    assert.equal(calls.some((c) => c.method === 'sendMessage'), false);
  });

  it('responde callbacks fora dos prefixos conhecidos', async () => {
    const bot = createBot({ token: '111:TESTE', logger: silentLogger });
    registerCallbackHandler(bot, { logger: silentLogger, users: makeStore() });
    const calls = stubTelegram();

    await bot.handleUpdate(callbackUpdate(31, 'outro_prefixo'));

    assert.ok(calls.some((c) => c.method === 'answerCallbackQuery'));
  });
});


describe('comando /help', () => {
  it('responde com a lista de comandos e os botões do menu', async () => {
    const bot = createBot({ token: '111:TESTE', logger: silentLogger });
    registerHelpCommand(bot, { logger: silentLogger });
    const calls = stubTelegram();

    await bot.handleUpdate({
      update_id: 50,
      message: {
        message_id: 50,
        date: 1,
        chat: { id: 42, type: 'private' },
        from: { id: 42, is_bot: false, first_name: 'Teste' },
        text: '/help',
        entities: [{ type: 'bot_command', offset: 0, length: 5 }],
      },
    });

    const send = calls.find((c) => c.method === 'sendMessage');
    assert.ok(send, 'deve responder ao /help');
    for (const c of BOT_COMMANDS) {
      assert.match(String(send?.payload.text), new RegExp('/' + c.command));
    }
    const markup = send?.payload.reply_markup as { inline_keyboard: unknown[][] };
    assert.equal(markup.inline_keyboard.flat().length, 4, 'deve trazer o menu');
  });
});

describe('mensagens que não são comandos', () => {
  it('responde texto solto apontando para o menu, sem ficar mudo', async () => {
    const bot = createBot({ token: '111:TESTE', logger: silentLogger });
    registerMessageHandler(bot, { logger: silentLogger });
    const calls = stubTelegram();

    await bot.handleUpdate(textUpdate(60, 'oi'));

    const send = calls.find((c) => c.method === 'sendMessage');
    assert.ok(send, 'não pode ficar sem resposta');
    assert.match(String(send?.payload.text), /\/start/);
    const markup = send?.payload.reply_markup as { inline_keyboard: unknown[][] };
    assert.equal(markup.inline_keyboard.flat().length, 4);
  });

  it('o /start tem prioridade sobre a resposta genérica', async () => {
    const bot = createBot({ token: '111:TESTE', logger: silentLogger });
    registerStartCommand(bot, {
      config: { startMediaPath: path.join(dataDir, 'inexistente.mp4') },
      logger: silentLogger,
      users: makeStore(),
      mediaCache: makeCache(),
    });
    registerMessageHandler(bot, { logger: silentLogger });
    const calls = stubTelegram();

    await bot.handleUpdate(startUpdate(61, { id: 9500, username: 'prioridade' }));

    const sends = calls.filter((c) => c.method === 'sendMessage');
    assert.equal(sends.length, 1, 'deve responder uma vez só');
    assert.match(String(sends[0]?.payload.text), /@prioridade/, 'deve ser a saudação do /start');
  });
});

describe('publicação dos comandos no Telegram', () => {
  it('envia a lista de comandos para a API', async () => {
    const bot = createBot({ token: '111:TESTE', logger: silentLogger });
    const calls = stubTelegram();

    await publishBotCommands(bot, silentLogger);

    const call = calls.find((c) => c.method === 'setMyCommands');
    assert.ok(call, 'deve chamar setMyCommands');
    assert.deepEqual(call?.payload.commands, BOT_COMMANDS.map((c) => ({ command: c.command, description: c.description })));
  });

  it('não quebra o bot se a publicação falhar', async () => {
    const bot = createBot({ token: '111:TESTE', logger: silentLogger });
    stubTelegram();
    // Força a falha da API apenas neste método.
    const proto = Telegram.prototype as unknown as {
      callApi: (m: string, p?: unknown) => Promise<unknown>;
    };
    const original = proto.callApi;
    proto.callApi = (m: string) => {
      if (m === 'setMyCommands') return Promise.reject(new Error('rede fora'));
      return Promise.resolve(true);
    };

    await assert.doesNotReject(() => publishBotCommands(bot, silentLogger));
    proto.callApi = original;
  });
});


describe('segurança do painel do dono', () => {
  const OWNER_ID = 8072791511;

  function adminBot() {
    const users = makeStore(OWNER_ID);
    const bot = createBot({ token: '111:TESTE', logger: silentLogger });
    registerCallbackHandler(bot, { logger: silentLogger, users });
    return { bot, users };
  }

  it('o dono abre as estatísticas', async () => {
    const { bot } = adminBot();
    const calls = stubTelegram();

    await bot.handleUpdate(callbackUpdate(70, CALLBACKS.ADMIN_STATS, OWNER_ID));

    const edit = calls.find((c) => c.method === 'editMessageCaption');
    assert.ok(edit, 'o dono deve conseguir abrir');
    assert.match(String(edit?.payload.caption), /𝐄𝐬𝐭𝐚𝐭í𝐬𝐭𝐢𝐜𝐚𝐬/);
  });

  it('um usuário comum NÃO abre o painel mesmo forjando o callback', async () => {
    const { bot } = adminBot();
    const calls = stubTelegram();

    // 999 nao e o dono, mas envia o callback de admin de proposito.
    await bot.handleUpdate(callbackUpdate(71, CALLBACKS.ADMIN_STATS, 999));

    assert.equal(
      calls.some((c) => c.method === 'editMessageCaption'),
      false,
      'não pode renderizar a tela restrita',
    );
    const answer = calls.find((c) => c.method === 'answerCallbackQuery');
    assert.equal(String(answer?.payload.text), 'Acesso restrito.');
  });

  it('um usuário comum NÃO abre a lista de usuários', async () => {
    const { bot } = adminBot();
    const calls = stubTelegram();

    await bot.handleUpdate(callbackUpdate(72, CALLBACKS.ADMIN_USERS, 999));

    assert.equal(calls.some((c) => c.method === 'editMessageCaption'), false);
    const answer = calls.find((c) => c.method === 'answerCallbackQuery');
    assert.equal(String(answer?.payload.text), 'Acesso restrito.');
  });

  it('a resposta de acesso restrito não vaza dados de usuários', async () => {
    const { bot, users } = adminBot();
    users.touch({ id: 555, username: 'vitima', first_name: 'V' });
    const calls = stubTelegram();

    await bot.handleUpdate(callbackUpdate(73, CALLBACKS.ADMIN_USERS, 999));

    const texto = JSON.stringify(calls.map((c) => c.payload));
    assert.equal(texto.includes('vitima'), false, 'não pode vazar nome de usuário');
    assert.equal(texto.includes('555'), false, 'não pode vazar ID de usuário');
  });

  it('telas comuns seguem abertas para qualquer usuário', async () => {
    const { bot } = adminBot();
    const calls = stubTelegram();

    await bot.handleUpdate(callbackUpdate(74, CALLBACKS.MENU_PROFILE, 999));

    assert.ok(calls.some((c) => c.method === 'editMessageCaption'), 'o perfil é público');
  });
});
