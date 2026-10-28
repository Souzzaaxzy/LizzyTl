/**
 * Tipos mínimos do fork da Baileys que a Lizzy realmente usa.
 *
 * Motivo de existir: o fork publica `WAProto/index.d.ts` com um `enum` aninhado
 * dentro de classe, que é sintaxe inválida em arquivo de declaração. O
 * `skipLibCheck` não cobre erro de sintaxe, então importar os tipos do pacote
 * quebra o `tsc` inteiro.
 *
 * O código em si funciona: só a tipagem está quebrada. Por isso declaramos aqui
 * o contrato que usamos e carregamos o pacote de forma que o TS não siga o
 * `.d.ts` defeituoso. Se o fork corrigir isso, basta voltar a importar de lá.
 */

export interface BaileysCredsUpdate {
  registered?: boolean;
  me?: { id?: string };
}

export interface BaileysAuthState {
  creds: BaileysCredsUpdate;
  keys: unknown;
}

export interface BaileysConnectionUpdate {
  connection?: 'connecting' | 'open' | 'close';
  qr?: string;
  lastDisconnect?: { error?: { output?: { statusCode?: number }; message?: string } };
}

export interface BaileysSocket {
  ev: {
    on(event: 'creds.update', handler: () => void): void;
    on(event: 'connection.update', handler: (update: BaileysConnectionUpdate) => void): void;
    on(event: string, handler: (...args: never[]) => void): void;
  };
  requestPairingCode(phoneNumber: string, customPairingCode?: string): Promise<string>;
  sendMessage(jid: string, content: unknown): Promise<unknown>;
  end(reason?: unknown): void;
}

export interface BaileysMakeSocketOptions {
  auth: BaileysAuthState;
  logger: unknown;
  browser: unknown;
}

export type BaileysMakeSocket = (options: BaileysMakeSocketOptions) => BaileysSocket;

export interface BaileysModule {
  default: BaileysMakeSocket;
  makeWASocket: BaileysMakeSocket;
  /** O fork expõe Browsers e DisconnectReason no nível do módulo. */
  Browsers: {
    ubuntu: (...args: string[]) => unknown;
    [k: string]: (...args: string[]) => unknown;
  };
  useMultiFileAuthState(dir: string): Promise<{
    state: BaileysAuthState;
    saveCreds: () => Promise<void>;
  }>;
  DisconnectReason: Record<string, number>;
}
