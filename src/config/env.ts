/**
 * Carregamento do arquivo .env.
 *
 * O `dotenv/config` resolve caminhos relativos a process.cwd(), o que falha
 * quando o processo é iniciado de outro diretório. Aqui o caminho é ancorado na
 * raiz do projeto, então o bot funciona de qualquer pasta.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as dotenv from 'dotenv';

/**
 * Raiz do projeto, resolvida a partir deste arquivo.
 *
 * Em ESM não existe __dirname, então o caminho vem de import.meta.url. Funciona
 * tanto rodando de src/ (tsx) quanto de dist/ (build).
 */
const esteArquivo = fileURLToPath(import.meta.url);
export const PROJECT_ROOT = path.resolve(path.dirname(esteArquivo), '..', '..');

export interface EnvFileInfo {
  /** Caminho onde o .env foi procurado. */
  path: string;
  /** Se o arquivo realmente existe nesse caminho. */
  exists: boolean;
}

/**
 * Procura o .env primeiro na raiz do projeto e, se não houver, no diretório
 * atual. Devolve o caminho esperado para que a validação possa explicar ao
 * operador exatamente onde o arquivo deveria estar.
 */
export function loadEnvFile(projectRoot: string = PROJECT_ROOT): EnvFileInfo {
  const projectEnvPath = path.join(projectRoot, '.env');
  if (fs.existsSync(projectEnvPath)) {
    dotenv.config({ path: projectEnvPath });
    return { path: projectEnvPath, exists: true };
  }

  const cwdEnvPath = path.resolve(process.cwd(), '.env');
  if (cwdEnvPath !== projectEnvPath && fs.existsSync(cwdEnvPath)) {
    dotenv.config({ path: cwdEnvPath });
    return { path: cwdEnvPath, exists: true };
  }

  return { path: projectEnvPath, exists: false };
}
