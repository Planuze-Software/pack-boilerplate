import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import {
  DEFAULT_PLANUZE_API_URL,
  DEFAULT_PLANUZE_REGISTRY_URL,
  buildPlanuzeEnvironment,
} from '../scripts/run-planuze.mjs';

const packDir = dirname(dirname(fileURLToPath(import.meta.url)));
const activatedReleaseWorkflow =
  'Planuze-Software/cms/.github/workflows/pack-release.yml@4f72bac3b62cf120434900e64b3c3eb50e2852db';

test('manifest declares runtime capabilities, app floor and bundled agent', async () => {
  const manifest = JSON.parse(await readFile(join(packDir, 'manifest.json'), 'utf8'));

  assert.equal(manifest.stack.minAppVersion, '0.0.13');
  assert.deepEqual(manifest.stack.requires, ['runtime.node', 'fs.write']);
  assert.deepEqual(manifest.agent, {
    entrypoint: 'agent/description/index.md',
    workflowIds: [],
  });
});

test('source templates remain parseable before placeholder rendering', async () => {
  const template = await readFile(join(packDir, 'base/greeter/greet.ts.tpl'), 'utf8');

  assert.doesNotMatch(template, /process\.env\.[^\s;]*\{\{/);
  assert.match(template, /process\.env\['HELLO_\{\{MODULE\}\}_SIGNATURE'\]/);
});

test('validation workflow never receives publishing credentials', async () => {
  const workflow = await readFile(join(packDir, '.github/workflows/ci.yml'), 'utf8');

  assert.doesNotMatch(workflow, /PLANUZE_(?:PUBLISH_TOKEN|SIGNING_KEY)/);
  assert.doesNotMatch(workflow, /pack publish|pack release/);
  assert.doesNotMatch(workflow, /uses:\s+actions\/(?:checkout|setup-node)@v\d/);
  assert.match(workflow, /permissions:\n\s+contents: read/);
  assert.match(workflow, /npm ci --ignore-scripts/);
  assert.match(workflow, /npm run verify/);
});

test('local CLI wrapper provides canonical endpoints without requiring variables', () => {
  const fallback = buildPlanuzeEnvironment({ PATH: '/bin' });
  assert.equal(fallback.PLANUZE_API_URL, DEFAULT_PLANUZE_API_URL);
  assert.equal(fallback.PLANUZE_REGISTRY_URL, DEFAULT_PLANUZE_REGISTRY_URL);

  const overridden = buildPlanuzeEnvironment({
    PLANUZE_API_URL: 'https://api.dev.example/v1',
    PLANUZE_REGISTRY_URL: 'https://registry.dev.example/v1',
  });
  assert.equal(overridden.PLANUZE_API_URL, 'https://api.dev.example/v1');
  assert.equal(overridden.PLANUZE_REGISTRY_URL, 'https://registry.dev.example/v1');
});

test('authoring contract pins the published CLI and the activated release workflow', async () => {
  const packageJson = JSON.parse(await readFile(join(packDir, 'package.json'), 'utf8'));
  const readme = await readFile(join(packDir, 'README.md'), 'utf8');

  assert.equal(packageJson.devDependencies['@planuze/pack-publisher'], '0.4.0');
  assert.match(readme, new RegExp(activatedReleaseWorkflow.replaceAll('/', '\\/')));
  assert.match(readme, /PLANUZE_SIGNING_KEY` é uma variable protegida do tipo \*\*File\*\*/);
  assert.match(readme, /cp "\$PLANUZE_SIGNING_KEY" "\$key_path"/);
  assert.match(readme, /PLANUZE_SIGNING_KEY_B64/);
  assert.match(readme, /base64 --decode > "\$key_path"/);
  assert.match(readme, /createPrivateKey/);
  assert.match(readme, /0\.4\.1.*publicada/s);
  assert.doesNotMatch(readme, /printf '%s' "\$PLANUZE_SIGNING_KEY" > "\$key_path"/);
  assert.match(readme, /test "\$CI_COMMIT_TAG" = "\$expected_tag"/);
  assert.match(readme, /test "\$BITBUCKET_TAG" = "\$expected_tag"/);
  assert.match(readme, /planuze pack release \[pack-dir\]/);
  assert.doesNotMatch(readme, /<40_CHAR_COMMIT_SHA>|@planuze\/pack-publisher@0\.3\.3/);
});
