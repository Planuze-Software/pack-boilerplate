#!/usr/bin/env node
import { access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const packDir = dirname(dirname(fileURLToPath(import.meta.url)));
export const LOCAL_KEY_DIR = join(packDir, '.local-keys');
export const LOCAL_PRIVATE_KEY_PATH = join(LOCAL_KEY_DIR, 'publisher.key');
export const LOCAL_PUBLIC_KEY_PATH = join(LOCAL_KEY_DIR, 'publisher.key.pub');

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function findExistingLocalKeys() {
  const candidates = [LOCAL_PRIVATE_KEY_PATH, LOCAL_PUBLIC_KEY_PATH];
  const present = await Promise.all(candidates.map(async (path) => ((await exists(path)) ? path : null)));
  return present.filter(Boolean);
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  const existing = await findExistingLocalKeys();
  if (existing.length > 0) {
    console.error('keygen recusado: uma identidade local já existe.');
    for (const path of existing) console.error(`  - ${path}`);
    console.error('Preserve essa chave enquanto houver releases assinados por ela; rotação é um fluxo explícito.');
    process.exitCode = 1;
  } else {
    const runner = join(packDir, 'scripts', 'run-planuze.mjs');
    const result = spawnSync(
      process.execPath,
      [runner, 'pack', 'publisher:keygen', `--output=${LOCAL_KEY_DIR}`],
      { cwd: packDir, stdio: 'inherit' },
    );
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  }
}
