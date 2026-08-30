#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SOURCE_PUBLIC_KEY_FINGERPRINT =
  'sha256:0000000000000000000000000000000000000000000000000000000000000000';

const packDir = dirname(dirname(fileURLToPath(import.meta.url)));

export function findSourceManifestSigningIssues(manifest) {
  const issues = [];

  if (manifest?.publicKeyFingerprint !== SOURCE_PUBLIC_KEY_FINGERPRINT) {
    issues.push(
      `publicKeyFingerprint precisa permanecer exatamente ${SOURCE_PUBLIC_KEY_FINGERPRINT}`,
    );
  }

  if (Object.hasOwn(manifest ?? {}, 'publisherFingerprint')) {
    issues.push(
      'publisherFingerprint não pertence ao manifest-fonte; o build atestado injeta o valor real',
    );
  }

  return issues;
}

export async function checkSourceManifest({ manifestPath = join(packDir, 'manifest.json') } = {}) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const issues = findSourceManifestSigningIssues(manifest);
  return { allowed: issues.length === 0, issues };
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  const result = await checkSourceManifest();
  if (result.allowed) {
    console.log('check:source-manifest — placeholder de assinatura correto.');
  } else {
    console.error('check:source-manifest — contrato de assinatura do manifest-fonte inválido:');
    for (const issue of result.issues) console.error(`  - ${issue}`);
    process.exitCode = 1;
  }
}
