import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import { createLogger } from '../src/core/logger.js';
import { DEFAULT_WHATSAPP_PAIRING_CODE, parsePositiveInt } from '../src/config/config.js';
import {
  PAIRING_ALPHABET,
  WhatsAppClient,
  isValidPairingCode,
  normalizeWhatsappNumber,
  type WhatsAppSocketLike,
} from '../src/whatsapp/client.js';
import type { BaileysModule } from '../src/whatsapp/baileys-types.js';
import { WhatsAppManager } from '../src/whatsapp/manager.js';

const silentLogger = createLogger('error');

/** Sessão em memória: o número pertence a um usuário específico. */
function fakeSession(userId = 42, number?: string) {
  return {
    userId,
    number,
    authDir: `/tmp/lizzy-wa-auth-${userId}`,
    createdAt: undefined,
  };
}

/** Socket falso: registra o que foi chamado, sem abrir conexão. */
function fakeSocket() {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const chamadas: { metodo: string; args: unknown[] }[] = [];
  const socket: WhatsAppSocketLike & { emitir: (e: string, u: unknown) => void } = {
    ev: {
      on: (evento: string, handler: (...args: unknown[]) => void) => {
        handlers.set(evento, handler);
      },
    },
    requestPairingCode: async (numero: string, codigo?: string) => {
      chamadas.push({ metodo: 'requestPairingCode', args: [numero, codigo] });
      return codigo ?? 'GERADO123';
    },
    sendMessage: async () => undefined,
    end: () => {
      chamadas.push({ metodo: 'end', args: [] });
    },
    emitir: (evento: string, u: unknown) => handlers.get(evento)?.(u),
  };
  return { socket, chamadas, handlers };
}

/** Módulo falso do Baileys, para não ler o pacote do disco. */
function fakeModule(socket: ReturnType<typeof fakeSocket>['socket']): BaileysModule {
  return {
    default: () => socket,
    makeWASocket: () => socket,
    Browsers: { ubuntu: () => ({}) },
    useMultiFileAuthState: async () => ({
      state: { creds: { registered: false }, keys: {} },
      saveCreds: async () => undefined,
    }),
    DisconnectReason: { loggedOut: 401 },
  } as unknown as BaileysModule;
}

function makeClient(numeroInicial: string | null = '5511999999999') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lizzy-wa-'));
  const { socket, chamadas } = fakeSocket();
  // null significa "sem número": undefined acionaria o valor padrão do parâmetro.
  const session = fakeSession(42, numeroInicial ?? undefined);
  session.authDir = dir;
  const codigos: string[] = [];
  const client = new WhatsAppClient({
    config: { whatsappPairingCode: DEFAULT_WHATSAPP_PAIRING_CODE },
    logger: silentLogger,
    session,
    loadModule: async () => fakeModule(socket),
    onPairingCode: (c) => codigos.push(c),
  });
  return { client, socket, chamadas, dir, session, codigos };
}

describe('normalizeWhatsappNumber', () => {
  it('remove tudo que não é dígito', () => {
    assert.equal(normalizeWhatsappNumber('+55 (11) 99999-9999'), '5511999999999');
    assert.equal(normalizeWhatsappNumber('5511999999999'), '5511999999999');
    assert.equal(normalizeWhatsappNumber(' 55 11 9 9999 9999 '), '5511999999999');
  });
});

describe('isValidPairingCode', () => {
  it('aceita o código padrão da Lizzy', () => {
    assert.equal(isValidPairingCode(DEFAULT_WHATSAPP_PAIRING_CODE), true);
    assert.equal(DEFAULT_WHATSAPP_PAIRING_CODE, 'L1ZZYB9T');
  });

  it('exige exatamente 8 caracteres', () => {
    assert.equal(isValidPairingCode('L1ZZYB9'), false);
    assert.equal(isValidPairingCode('L1ZZYB9TT'), false);
    assert.equal(isValidPairingCode(''), false);
  });

  it('rejeita caracteres fora do alfabeto do WhatsApp', () => {
    // O alfabeto Crockford não tem I, O, L nem símbolos.
    assert.equal(isValidPairingCode('LIZZYBOT'), false, 'I e O não existem no alfabeto');
    assert.equal(isValidPairingCode('lizz-ybot'.slice(0, 8)), false, 'hífen é inválido');
    assert.equal(isValidPairingCode('ABCDEFG0'), false, 'zero não existe no alfabeto');
  });

  it('aceita minúsculas, normalizando', () => {
    assert.equal(isValidPairingCode('l1zzyb9t'), true);
  });

  it('o alfabeto é o Crockford Base32', () => {
    assert.equal(PAIRING_ALPHABET, '123456789ABCDEFGHJKLMNPQRSTVWXYZ');
    assert.equal(PAIRING_ALPHABET.length, 32);
  });
});

describe('WhatsAppClient', () => {
  it('fica desligado sem número informado, sem tentar conectar', async () => {
    const client = new WhatsAppClient({
      config: { whatsappPairingCode: DEFAULT_WHATSAPP_PAIRING_CODE },
      logger: silentLogger,
      session: fakeSession(42, undefined),
      loadModule: async () => {
        throw new Error('não deveria carregar o pacote');
      },
    });

    await client.start();

    assert.equal(client.getStatus().state, 'desligado');
    assert.equal(client.isConnected(), false);
    assert.match(client.getStatus().summary, /Conectar WhatsApp/);
  });

  it('recusa código de pareamento inválido antes de conectar', async () => {
    const client = new WhatsAppClient({
      config: { whatsappPairingCode: 'lizz-ybot' },
      logger: silentLogger,
      session: fakeSession(42, '5511999999999'),
      loadModule: async () => {
        throw new Error('não deveria carregar o pacote');
      },
    });

    await client.start();

    assert.equal(client.getStatus().state, 'erro');
    assert.match(client.getStatus().summary, /8 caracteres/);
  });

  it('pede o pareamento com o código configurado', async () => {
    const { client, chamadas, codigos } = makeClient();

    await client.start();

    const pedido = chamadas.find((c) => c.metodo === 'requestPairingCode');
    assert.ok(pedido, 'deve pedir o código de pareamento');
    assert.equal(pedido?.args[0], '5511999999999');
    assert.equal(pedido?.args[1], 'L1ZZYB9T', 'deve usar o código da Lizzy');
    assert.equal(client.getStatus().state, 'aguardando_pareamento');
    assert.match(client.getStatus().summary, /L1ZZYB9T/);
    assert.deepEqual(codigos, ['L1ZZYB9T'], 'o código é avisado para o bot enviar no chat');
  });

  it('connectNumber normaliza e conecta com o número informado', async () => {
    const { client, chamadas } = makeClient(null);

    const aceitou = await client.connectNumber('+55 (11) 98888-7777');

    assert.equal(aceitou, true);
    assert.equal(client.numeroConectado(), '5511988887777', 'normaliza para só dígitos');
    const pedido = chamadas.find((c) => c.metodo === 'requestPairingCode');
    assert.equal(pedido?.args[0], '5511988887777');
  });

  it('recusa número curto demais sem tentar conectar', async () => {
    const { client, chamadas } = makeClient(null);

    const aceitou = await client.connectNumber('123');

    assert.equal(aceitou, false);
    assert.equal(client.getStatus().state, 'erro');
    assert.match(client.getStatus().summary, /inválido/i);
    assert.equal(chamadas.length, 0, 'não tenta conectar');
  });

  it('desconectar encerra a sessão e apaga as credenciais', async () => {
    const { client, dir } = makeClient();

    await client.start();
    client.desconectar();

    assert.equal(client.getStatus().state, 'desligado');
    assert.equal(client.isConnected(), false);
    assert.equal(fs.existsSync(dir), false, 'credenciais apagadas');
  });

  it('não afirma conectado antes de a conexão abrir', async () => {
    const { client } = makeClient();

    await client.start();
    assert.equal(client.isConnected(), false, 'ainda não abriu');
    assert.notEqual(client.getStatus().state, 'conectado');
  });

  it('marca conectado quando a conexão abre', async () => {
    const { client, socket } = makeClient();

    await client.start();
    socket.emitir('connection.update', { connection: 'open' });

    assert.equal(client.isConnected(), true);
    assert.equal(client.getStatus().state, 'conectado');
  });

  it('reporta erro e agenda reconexão quando a conexão cai', async () => {
    const { client, socket } = makeClient();

    await client.start();
    socket.emitir('connection.update', {
      connection: 'close',
      lastDisconnect: { error: { output: { statusCode: 500 } } },
    });

    assert.equal(client.getStatus().state, 'erro');
    assert.match(client.getStatus().summary, /reconectar/i);
    client.stop();
  });

  it('não tenta reconectar quando a sessão foi encerrada no celular', async () => {
    const { client, socket } = makeClient();

    await client.start();
    socket.emitir('connection.update', {
      connection: 'close',
      lastDisconnect: { error: { output: { statusCode: 401 } } },
    });

    assert.equal(client.getStatus().state, 'erro');
    // O texto orienta pela interface, não por caminho de arquivo: quem usa o
    // bot não deve precisar mexer em disco.
    assert.match(client.getStatus().summary, /Desconectar e Conectar/);
    client.stop();
  });

  it('stop encerra o socket e volta a desligado', async () => {
    const { client, chamadas } = makeClient();

    await client.start();
    client.stop();

    assert.equal(client.getStatus().state, 'desligado');
    assert.ok(chamadas.some((c) => c.metodo === 'end'), 'deve encerrar o socket');
  });
});

describe('WhatsAppManager: uma sessão por usuário', () => {
  function fakeManagerStore(iniciais: number[] = []) {
    const numeros = new Map<number, string>();
    const authDirs = new Map<number, string>();
    for (const id of iniciais) {
      numeros.set(id, '5511900000000');
      authDirs.set(id, fs.mkdtempSync(path.join(os.tmpdir(), `lizzy-mgr-${id}-`)));
    }
    return {
      authDirFor: (id: number) => authDirs.get(id) ?? `/tmp/lizzy-mgr-${id}`,
      get: (id: number) => ({
        userId: id,
        number: numeros.get(id),
        authDir: authDirs.get(id) ?? `/tmp/lizzy-mgr-${id}`,
        createdAt: undefined,
      }),
      set: (id: number, n: string) => {
        numeros.set(id, n);
        return { userId: id, number: n, authDir: `/tmp/lizzy-mgr-${id}`, createdAt: undefined };
      },
      clear: (id: number) => { numeros.delete(id); },
      clearAuth: (id: number) => { authDirs.delete(id); },
      listUserIds: () => [...numeros.keys()],
      count: () => numeros.size,
    };
  }

  /** Cria um manager com sockets falsos, sem tocar na rede. */
  function makeManager(opts: { comNumero?: number[]; maxSessions?: number } = {}) {
    const store = fakeManagerStore(opts.comNumero ?? []);
    const sockets = new Map<number, ReturnType<typeof fakeSocket>['socket']>();
    const codigos: { userId: number; code: string }[] = [];
    const mudancas: { userId: number; state: string; detalhe?: string }[] = [];

    const manager = new WhatsAppManager({
      store: store as never,
      logger: silentLogger,
      pairingCode: DEFAULT_WHATSAPP_PAIRING_CODE,
      maxSessions: opts.maxSessions ?? 20,
      onPairingCode: (userId, code) => codigos.push({ userId, code }),
      onStateChange: (userId, state, detalhe) => mudancas.push({ userId, state, detalhe }),
      loadModule: async () => {
        // Cada sessão recebe o próprio socket: é isso que garante isolamento.
        const criado = fakeSocket();
        sockets.set(sockets.size + 1, criado.socket);
        return fakeModule(criado.socket);
      },
    });

    return { manager, store, sockets, codigos, mudancas };
  }

  it('usuário sem sessão aparece desligado, sem criar socket', () => {
    const { manager, sockets } = makeManager();
    assert.equal(manager.getStatus(999).state, 'desligado');
    assert.equal(manager.isConnected(999), false);
    assert.equal(sockets.size, 0, 'não cria socket à toa');
  });

  it('conecta um número novo e guarda a sessão do usuário certo', async () => {
    const { manager, store, codigos } = makeManager();

    const resultado = await manager.connect(777, '5511988887777');

    assert.equal(resultado.ok, true);
    assert.equal(store.get(777).number, '5511988887777');
    assert.equal(manager.getStatus(777).state, 'aguardando_pareamento');
    // O código vai para quem pediu, nunca para outro.
    assert.equal(codigos.length, 1);
    assert.equal(codigos[0]?.userId, 777);
    assert.equal(codigos[0]?.code, 'L1ZZYB9T');
  });

  it('cada usuário tem sessão e socket próprios', async () => {
    const { manager } = makeManager();

    await manager.connect(111, '5511911111111');
    await manager.connect(222, '5511922222222');

    assert.equal(manager.activeCount(), 2, 'dois sockets independentes');
    assert.equal(manager.getStatus(111).state, 'aguardando_pareamento');
    assert.equal(manager.getStatus(222).state, 'aguardando_pareamento');
  });

  it('recusa número inválido sem guardar sessão', async () => {
    const { manager, store } = makeManager();

    const resultado = await manager.connect(333, '123');

    assert.equal(resultado.ok, false);
    assert.match(String(resultado.message), /inválido/i);
    assert.equal(store.get(333).number, undefined, 'não deixa rastro');
    assert.equal(manager.activeCount(), 0, 'não cria socket');
  });

  it('respeita o teto de sessões simultâneas', async () => {
    const { manager, store } = makeManager({ maxSessions: 2 });

    await manager.connect(1, '5511911111111');
    await manager.connect(2, '5511922222222');
    const recusado = await manager.connect(3, '5511933333333');

    assert.equal(recusado.ok, false);
    assert.match(String(recusado.message), /limite/i);
    assert.equal(manager.activeCount(), 2, 'não passa do teto');
    assert.equal(store.get(3).number, undefined, 'não guarda sessão recusada');
  });

  it('desconectar afeta só a sessão daquele usuário', async () => {
    const { manager, store } = makeManager();

    await manager.connect(111, '5511911111111');
    await manager.connect(222, '5511922222222');

    manager.desconectar(111);

    assert.equal(manager.getStatus(111).state, 'desligado');
    assert.equal(store.get(111).number, undefined, 'esqueceu o número do 111');
    assert.equal(manager.getStatus(222).state, 'aguardando_pareamento', 'o 222 continua');
    assert.equal(store.get(222).number, '5511922222222', 'número do 222 intacto');
  });

  it('retoma as sessões guardadas ao subir', async () => {
    const { manager } = makeManager({ comNumero: [11, 22] });

    await manager.startAll();

    assert.equal(manager.activeCount(), 2);
    assert.equal(manager.getStatus(11).state, 'aguardando_pareamento');
    assert.equal(manager.getStatus(22).state, 'aguardando_pareamento');
  });

  it('reconectar o mesmo usuário substitui a sessão, sem acumular', async () => {
    const { manager, store } = makeManager();

    await manager.connect(555, '5511955555555');
    await manager.connect(555, '5511966666666');

    // Uma sessão por usuário: o segundo número substitui o primeiro.
    assert.equal(manager.activeCount(), 1, 'não acumula sessões na mesma conta');
    assert.equal(store.get(555).number, '5511966666666', 'vale o número mais recente');
  });

  it('o teto global conta sessões, não usuários', async () => {
    const { manager } = makeManager({ maxSessions: 3 });

    await manager.connect(1, '5511911111111');
    await manager.connect(2, '5511922222222');
    await manager.connect(3, '5511933333333');

    assert.equal(manager.activeCount(), 3);
    assert.equal((await manager.connect(4, '5511944444444')).ok, false, 'quarto é recusado');
  });

  it('stopAll encerra todas as sessões', async () => {
    const { manager } = makeManager();

    await manager.connect(1, '5511911111111');
    await manager.connect(2, '5511922222222');
    manager.stopAll();

    assert.equal(manager.activeCount(), 0);
  });
});


describe('aviso de mudança de estado', () => {
  function makeSimpleClient() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lizzy-st-'));
    const { socket, chamadas } = fakeSocket();
    const session = fakeSession(42, '5511999999999');
    session.authDir = dir;
    const eventos: { state: string; detalhe?: string }[] = [];
    const client = new WhatsAppClient({
      config: { whatsappPairingCode: DEFAULT_WHATSAPP_PAIRING_CODE },
      logger: silentLogger,
      session,
      loadModule: async () => fakeModule(socket),
      onStateChange: (state, detalhe) => eventos.push({ state, detalhe }),
    });
    return { client, socket, eventos, chamadas };
  }

  it('avisa quando a conexão abre, com o número', async () => {
    const { client, socket, eventos } = makeSimpleClient();

    await client.start();
    socket.emitir('connection.update', { connection: 'open' });

    const conectou = eventos.find((e) => e.state === 'conectado');
    assert.ok(conectou, 'deve avisar que conectou');
    assert.equal(conectou?.detalhe, '5511999999999', 'leva o número no aviso');
  });

  it('avisa quando a sessão é encerrada no celular', async () => {
    const { client, socket, eventos } = makeSimpleClient();

    await client.start();
    socket.emitir('connection.update', {
      connection: 'close',
      lastDisconnect: { error: { output: { statusCode: 401 } } },
    });

    const erro = eventos.find((e) => e.state === 'erro');
    assert.ok(erro, 'deve avisar do encerramento');
    assert.match(String(erro?.detalhe), /encerrada no celular/);
    client.stop();
  });

  it('não repete o aviso se o estado não mudou', async () => {
    const { client, socket, eventos } = makeSimpleClient();

    await client.start();
    socket.emitir('connection.update', { connection: 'open' });
    socket.emitir('connection.update', { connection: 'open' });
    socket.emitir('connection.update', { connection: 'open' });

    const avisos = eventos.filter((e) => e.state === 'conectado');
    assert.equal(avisos.length, 1, 'reconexão repetida não deve spammar o chat');
  });
});
