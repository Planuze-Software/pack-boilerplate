import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import {
  SOURCE_PUBLIC_KEY_FINGERPRINT,
  findSourceManifestSigningIssues,
} from '../scripts/check-source-manifest.mjs';

const packDir = dirname(dirname(fileURLToPath(import.meta.url)));

test('source manifest keeps only the canonical signing placeholder', async () => {
  const manifest = JSON.parse(await readFile(join(packDir, 'manifest.json'), 'utf8'));

  assert.equal(manifest.publicKeyFingerprint, SOURCE_PUBLIC_KEY_FINGERPRINT);
  assert.equal(Object.hasOwn(manifest, 'publisherFingerprint'), false);
  assert.deepEqual(findSourceManifestSigningIssues(manifest), []);
});

test('source signing gate rejects missing, malformed or real fingerprints', () => {
  assert.equal(findSourceManifestSigningIssues({}).length, 1);
  assert.equal(
    findSourceManifestSigningIssues({
      publicKeyFingerprint: `sha256:${'a'.repeat(64)}`,
    }).length,
    1,
  );
  assert.equal(
    findSourceManifestSigningIssues({
      publicKeyFingerprint: `sha256:${'0'.repeat(63)}`,
    }).length,
    1,
  );
});

test('publisher fingerprint is generated for the artifact, never accepted in source', () => {
  const issues = findSourceManifestSigningIssues({
    publicKeyFingerprint: SOURCE_PUBLIC_KEY_FINGERPRINT,
    publisherFingerprint: `sha256:${'a'.repeat(64)}`,
  });

  assert.equal(issues.length, 1);
  assert.match(issues[0], /publisherFingerprint não pertence ao manifest-fonte/);
});
