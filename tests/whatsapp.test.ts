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

const silentLogger = createLogger('error');

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

function makeClient(deps: Partial<Parameters<typeof WhatsAppClient.prototype.start>> = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lizzy-wa-'));
  const { socket, chamadas } = fakeSocket();
  const client = new WhatsAppClient({
    config: {
      whatsappNumber: '5511999999999',
      whatsappPairingCode: DEFAULT_WHATSAPP_PAIRING_CODE,
      whatsappAuthDir: dir,
    },
    logger: silentLogger,
    loadModule: async () => fakeModule(socket),
    ...deps,
  });
  return { client, socket, chamadas, dir };
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
  it('fica desligado sem número configurado, sem tentar conectar', async () => {
    const client = new WhatsAppClient({
      config: {
        whatsappNumber: undefined,
        whatsappPairingCode: DEFAULT_WHATSAPP_PAIRING_CODE,
        whatsappAuthDir: '/tmp/nao-usado',
      },
      logger: silentLogger,
      loadModule: async () => {
        throw new Error('não deveria carregar o pacote');
      },
    });

    await client.start();

    assert.equal(client.getStatus().state, 'desligado');
    assert.equal(client.isConnected(), false);
    assert.match(client.getStatus().summary, /WHATSAPP_NUMBER/);
  });

  it('recusa código de pareamento inválido antes de conectar', async () => {
    const client = new WhatsAppClient({
      config: {
        whatsappNumber: '5511999999999',
        whatsappPairingCode: 'lizz-ybot',
        whatsappAuthDir: '/tmp/nao-usado',
      },
      logger: silentLogger,
      loadModule: async () => {
        throw new Error('não deveria carregar o pacote');
      },
    });

    await client.start();

    assert.equal(client.getStatus().state, 'erro');
    assert.match(client.getStatus().summary, /8 caracteres/);
  });

  it('pede o pareamento com o código configurado', async () => {
    const { client, chamadas } = makeClient();

    await client.start();

    const pedido = chamadas.find((c) => c.metodo === 'requestPairingCode');
    assert.ok(pedido, 'deve pedir o código de pareamento');
    assert.equal(pedido?.args[0], '5511999999999');
    assert.equal(pedido?.args[1], 'L1ZZYB9T', 'deve usar o código da Lizzy');
    assert.equal(client.getStatus().state, 'aguardando_pareamento');
    assert.match(client.getStatus().summary, /L1ZZYB9T/);
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
    assert.match(client.getStatus().summary, /Apague data\/whatsapp-auth/);
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
