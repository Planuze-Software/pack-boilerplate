#!/usr/bin/env node
import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { buildPlanuzeEnvironment } from './run-planuze.mjs';

const packDir = dirname(dirname(fileURLToPath(import.meta.url)));
const cliPath = join(
  packDir,
  'node_modules',
  '@planuze',
  'pack-publisher',
  'bin',
  'planuze.js',
);
const buildDir = await mkdtemp(join(tmpdir(), 'planuze-pack-build-check-'));

try {
  const signingPair = generateKeyPairSync('ed25519');
  const signingKeyPath = join(buildDir, 'ephemeral-signing-key.pem');
  await writeFile(
    signingKeyPath,
    signingPair.privateKey.export({ format: 'pem', type: 'pkcs8' }),
    { mode: 0o600, flag: 'wx' },
  );

  const escrowPair = generateKeyPairSync('x25519');
  const escrowDer = escrowPair.publicKey.export({ format: 'der', type: 'spki' });
  const escrowPublicKey = escrowDer.subarray(-32).toString('base64');
  const result = spawnSync(
    process.execPath,
    [
      cliPath,
      'pack',
      'build',
      packDir,
      `--key=${signingKeyPath}`,
      `--escrow-public-key=${escrowPublicKey}`,
    ],
    {
      cwd: buildDir,
      env: buildPlanuzeEnvironment(),
      encoding: 'utf8',
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    process.exitCode = result.status ?? 1;
  } else {
    const artifacts = (await readdir(buildDir)).filter((name) => name.endsWith('.plnzpack'));
    if (artifacts.length !== 1) {
      throw new Error(`build deveria gerar um único .plnzpack; encontrados: ${artifacts.length}`);
    }
    console.log(`check:bundle — OK (${artifacts[0]}).`);
  }
} finally {
  await rm(buildDir, { recursive: true, force: true });
}
