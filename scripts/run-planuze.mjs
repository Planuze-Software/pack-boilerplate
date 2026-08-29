#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_PLANUZE_API_URL = 'https://api.planuze.com/v1';
export const DEFAULT_PLANUZE_REGISTRY_URL = 'https://registry.planuze.com/v1';

const packDir = dirname(dirname(fileURLToPath(import.meta.url)));

export function buildPlanuzeEnvironment(env = process.env) {
  return {
    ...env,
    PLANUZE_API_URL: env.PLANUZE_API_URL || DEFAULT_PLANUZE_API_URL,
    PLANUZE_REGISTRY_URL: env.PLANUZE_REGISTRY_URL || DEFAULT_PLANUZE_REGISTRY_URL,
  };
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  const cliPath = join(
    packDir,
    'node_modules',
    '@planuze',
    'pack-publisher',
    'bin',
    'planuze.js',
  );
  const result = spawnSync(process.execPath, [cliPath, ...process.argv.slice(2)], {
    env: buildPlanuzeEnvironment(),
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
