/* Path-safety para o generator.
 *
 * O generator escreve DENTRO do projeto do usuário. Todo write deve ficar
 * confinado ao diretório-base esperado — um template malicioso ou um symlink
 * plantado não pode fazer o generator escrever fora (path traversal). Estas
 * checagens são lexicais (`..`) E de realpath (symlink), espelhando o padrão
 * dos packs oficiais do Planuze. NUNCA use `startsWith('${base}/')` — é
 * POSIX-only e quebra no Windows.
 */
import { lstat, mkdir, realpath } from 'node:fs/promises';
import { writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

async function firstExistingRealpath(target) {
  let cursor = target;
  while (true) {
    try {
      return await realpath(cursor);
    } catch {
      const parent = dirname(cursor);
      if (parent === cursor) throw new Error('path_escape');
      cursor = parent;
    }
  }
}

/**
 * Resolve `base/...segments` garantindo que o resultado permanece dentro de
 * `base` (lexical + realpath). `createBase: true` cria o base antes de checar.
 */
export async function safeChildPath(base, segments, options = {}) {
  const baseResolved = resolve(base);
  if (options.createBase === true) await mkdir(baseResolved, { recursive: true });
  const target = resolve(baseResolved, ...segments);
  const lexicalRel = relative(baseResolved, target);
  if (
    lexicalRel === '' ||
    lexicalRel === '..' ||
    lexicalRel.startsWith(`..${sep}`) ||
    isAbsolute(lexicalRel)
  ) {
    throw new Error('path_escape');
  }
  const realBase = await realpath(baseResolved);
  const realCheck = await firstExistingRealpath(target);
  const realRel = relative(realBase, realCheck);
  if (realRel === '..' || realRel.startsWith(`..${sep}`) || isAbsolute(realRel)) {
    throw new Error('path_escape');
  }
  return target;
}

async function assertWritableFilePath(filePath) {
  const entry = await lstat(filePath).catch((error) => {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return null;
    throw error;
  });
  /* Recusa sobrescrever algo que não é um arquivo comum (dir, device) ou que é
     um symlink (o alvo do symlink poderia estar fora do base). */
  if (entry !== null && (!entry.isFile() || entry.isSymbolicLink())) {
    throw new Error('path_escape');
  }
}

export async function writeSafeFile(filePath, content) {
  await assertWritableFilePath(filePath);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content);
}
