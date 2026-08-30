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
  'Planuze-Software/cms/.github/workflows/pack-release.yml@4f154d2ddd9c5e0b19bc5637a45db001da7a2cc2';

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
  const yamlBlocks = [...readme.matchAll(/```yaml\n([\s\S]*?)```/gu)].map((match) => match[1]);
  const gitlabYaml = yamlBlocks.find((yaml) => yaml.includes('release_pack:'));
  const bitbucketYaml = yamlBlocks.find((yaml) => yaml.includes('pipelines:\n  tags:'));

  assert.equal(packageJson.devDependencies['@planuze/pack-publisher'], '0.4.1');
  assert.match(readme, new RegExp(activatedReleaseWorkflow.replaceAll('/', '\\/')));
  assert.doesNotMatch(readme, /4f72bac3b62cf120434900e64b3c3eb50e2852db/);
  assert.match(readme, /PLANUZE_SIGNING_KEY` é uma variable protegida do tipo \*\*File\*\*/);
  assert.match(readme, /Protected tags[\s\S]*wildcard `v\*`/);
  assert.match(readme, /Sem a tag protegida[\s\S]*não entrega[\s\S]*variables protegidas/);
  assert.match(readme, /cp "\$PLANUZE_SIGNING_KEY" "\$key_path"/);
  assert.match(readme, /PLANUZE_SIGNING_KEY_B64/);
  assert.match(readme, /Repository settings → Pipelines → Repository variables/);
  assert.match(readme, /\*\*secured variables\*\*[\s\S]*cadeado em ambas/);
  assert.doesNotMatch(readme, /Repository variables protegidas/);
  assert.match(readme, /base64 --decode > "\$key_path"/);
  assert.match(readme, /createPrivateKey/);
  assert.match(readme, /@planuze\/pack-publisher@0\.4\.1/);
  assert.doesNotMatch(readme, /@planuze\/pack-publisher@(?:latest|0\.4\.0)/);
  assert.doesNotMatch(readme, /printf '%s' "\$PLANUZE_SIGNING_KEY" > "\$key_path"/);
  assert.match(readme, /test "\$CI_COMMIT_TAG" = "\$expected_tag"/);
  assert.match(readme, /test "\$BITBUCKET_TAG" = "\$expected_tag"/);
  assert.ok(gitlabYaml);
  assert.match(gitlabYaml, /git check-ref-format --branch "\$CI_DEFAULT_BRANCH"/);
  assert.match(gitlabYaml, /git rev-parse --is-shallow-repository/);
  assert.match(gitlabYaml, /git fetch --no-tags --prune --unshallow origin "\$fetch_ref"/);
  assert.match(gitlabYaml, /git merge-base --is-ancestor "\$CI_COMMIT_SHA" "\$default_ref"/);
  assert.match(gitlabYaml, /test "\$\(git rev-parse HEAD\)" = "\$CI_COMMIT_SHA"/);
  assert.ok(bitbucketYaml);
  assert.match(bitbucketYaml, /git ls-remote --symref origin HEAD/);
  assert.match(bitbucketYaml, /refs\/heads\/\*/);
  assert.match(bitbucketYaml, /git check-ref-format "\$default_ref"/);
  assert.match(bitbucketYaml, /git rev-parse --is-shallow-repository/);
  assert.match(bitbucketYaml, /git fetch --no-tags --prune --unshallow origin "\$fetch_ref"/);
  assert.match(
    bitbucketYaml,
    /git merge-base --is-ancestor "\$BITBUCKET_COMMIT" "\$remote_default_ref"/,
  );
  assert.match(bitbucketYaml, /test "\$\(git rev-parse HEAD\)" = "\$BITBUCKET_COMMIT"/);
  assert.doesNotMatch(gitlabYaml, /git fetch[^\n]*\|\|/);
  assert.doesNotMatch(bitbucketYaml, /git fetch[^\n]*\|\|/);
  assert.match(readme, /planuze pack release \[pack-dir\]/);
  assert.doesNotMatch(readme, /<40_CHAR_COMMIT_SHA>|@planuze\/pack-publisher@0\.3\.3/);
  assert.match(readme, /PLANUZE_REGISTRY_URL` não precisa ser criada em nenhum provider/);
  assert.match(readme, /https:\/\/registry\.planuze\.com\/v1/);
  assert.ok(yamlBlocks.length >= 3);
  for (const yaml of yamlBlocks) {
    assert.doesNotMatch(yaml, /PLANUZE_REGISTRY_URL|SCAN_RUNNER_URL/);
  }
});
