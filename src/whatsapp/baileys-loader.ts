/**
 * Carregador do fork da Baileys.
 *
 * Motivo de existir: o fork publica `WAProto/index.d.ts` com um `enum` aninhado
 * dentro de classe, que é sintaxe inválida em arquivo de declaração. Como o
 * `skipLibCheck` não cobre erro de sintaxe, importar o pacote diretamente faz o
 * `tsc` falhar no projeto inteiro.
 *
 * O código do fork funciona normalmente — só a tipagem está quebrada. Aqui o
 * pacote é carregado em runtime, sem que o TypeScript siga o `.d.ts`, e o
 * contrato que usamos é declarado em `baileys-types.ts`.
 *
 * Se o fork corrigir a tipagem, este arquivo pode ser trocado por um import
 * normal, sem mexer no resto do código.
 */

import type { BaileysModule } from './baileys-types.js';

export type {
  BaileysAuthState,
  BaileysConnectionUpdate,
  BaileysMakeSocket,
  BaileysModule,
  BaileysSocket,
} from './baileys-types.js';

const NOME_PACOTE = '@souzzaaxzy/baileys';

let cache: BaileysModule | null = null;

/**
 * Carrega o pacote uma única vez e reusa. O `import()` fica em uma variável
 * para o TypeScript não tentar resolver os tipos do pacote.
 */
export async function loadBaileys(): Promise<BaileysModule> {
  if (cache !== null) {
    return cache;
  }
  // A variável evita que o TS resolva os tipos do pacote, que estão quebrados.
  const caminho: string = NOME_PACOTE;
  const modulo = (await import(caminho)) as unknown as BaileysModule;
  cache = modulo;
  return modulo;
}
