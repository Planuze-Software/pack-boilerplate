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
import {
  LOCAL_KEY_DIR,
  LOCAL_PRIVATE_KEY_PATH,
  LOCAL_PUBLIC_KEY_PATH,
} from '../scripts/keygen.mjs';

const packDir = dirname(dirname(fileURLToPath(import.meta.url)));
const publicCentralRuntime =
  'Planuze-Software/pack-scan-runner/.github/actions/pack-scan-runtime@bf702b28d758bf6eb9d5f29f06c3cacc230828d4';

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
  const packageJson = JSON.parse(await readFile(join(packDir, 'package.json'), 'utf8'));

  assert.doesNotMatch(workflow, /PLANUZE_(?:PUBLISH_TOKEN|SIGNING_KEY)/);
  assert.doesNotMatch(workflow, /pack publish|pack release/);
  assert.doesNotMatch(workflow, /tags:\s*\[/);
  assert.doesNotMatch(workflow, /pack-scan-runner/);
  assert.doesNotMatch(workflow, /uses:\s+actions\/(?:checkout|setup-node)@v\d/);
  assert.match(workflow, /permissions:\n\s+contents: read/);
  assert.match(workflow, /npm ci --ignore-scripts/);
  assert.match(workflow, /Verify source placeholder and pack/);
  assert.match(workflow, /npm run verify/);
  assert.match(packageJson.scripts.verify, /npm run check:source-manifest/);
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

test('local key commands share one ignored identity and do not use a stray PEM', async () => {
  const packageJson = JSON.parse(await readFile(join(packDir, 'package.json'), 'utf8'));
  const gitignore = await readFile(join(packDir, '.gitignore'), 'utf8');

  assert.equal(LOCAL_KEY_DIR, join(packDir, '.local-keys'));
  assert.equal(LOCAL_PRIVATE_KEY_PATH, join(packDir, '.local-keys', 'publisher.key'));
  assert.equal(LOCAL_PUBLIC_KEY_PATH, join(packDir, '.local-keys', 'publisher.key.pub'));
  assert.equal(packageJson.scripts.keygen, 'node scripts/keygen.mjs');
  assert.match(packageJson.scripts['register-key'], /--key=\.local-keys\/publisher\.key/);
  assert.match(packageJson.scripts['build:local'], /--key=\.local-keys\/publisher\.key/);
  assert.doesNotMatch(packageJson.scripts['build:local'], /signing-key\.pem/);
  assert.match(gitignore, /^\.local-keys\/$/m);
});

test('authoring contract pins the published CLI and provider-neutral central release', async () => {
  const packageJson = JSON.parse(await readFile(join(packDir, 'package.json'), 'utf8'));
  const readme = await readFile(join(packDir, 'README.md'), 'utf8');
  const yamlBlocks = [...readme.matchAll(/```yaml\n([\s\S]*?)```/gu)].map((match) => match[1]);
  const githubYaml = yamlBlocks.find((yaml) => yaml.includes('name: Release pack'));
  const gitlabYaml = yamlBlocks.find((yaml) => yaml.includes('release_pack:'));
  const bitbucketYaml = yamlBlocks.find((yaml) => yaml.includes('pipelines:\n  tags:'));

  assert.equal(packageJson.devDependencies['@planuze/pack-publisher'], '0.4.7');
  assert.ok(githubYaml);
  assert.match(githubYaml, new RegExp(publicCentralRuntime.replaceAll('/', '\\/')));
  assert.doesNotMatch(readme, /Planuze-Software\/cms|pack-release\.yml|SHA H1/);
  assert.doesNotMatch(githubYaml, /id-token:\s*write|workflow_call/);
  assert.match(githubYaml, /permissions:\n\s+contents: read/);
  assert.match(githubYaml, /fetch-depth: 0/);
  assert.match(githubYaml, /persist-credentials: false/);
  assert.match(githubYaml, /github\.event\.repository\.default_branch/);
  assert.match(githubYaml, /git merge-base --is-ancestor "\$GITHUB_SHA" "\$default_ref"/);
  assert.match(githubYaml, /process\.env\.GITHUB_REF_NAME !== expectedTag/);
  assert.match(githubYaml, /zeroFingerprint/);
  assert.match(githubYaml, /mktemp -d "\$RUNNER_TEMP\/planuze-pack-release\.XXXXXX"/);
  assert.match(githubYaml, /-u ACTIONS_ID_TOKEN_REQUEST_URL/);
  assert.match(githubYaml, /-u ACTIONS_ID_TOKEN_REQUEST_TOKEN/);
  assert.match(githubYaml, /"\$cli_path" pack release "\$workspace"/);
  assert.match(githubYaml, /Cleanup trusted CLI runtime/);
  assert.match(githubYaml, /PLANUZE_PUBLISHER_TOKEN: \$\{\{ secrets\.PLANUZE_PUBLISH_TOKEN \}\}/);
  assert.match(githubYaml, /SIGNING_KEY_PEM: \$\{\{ secrets\.PLANUZE_SIGNING_KEY \}\}/);
  const githubSecrets = [
    ...githubYaml.matchAll(/\$\{\{\s*secrets\.([A-Z0-9_]+)\s*\}\}/gu),
  ]
    .map((match) => match[1])
    .sort();
  assert.deepEqual(githubSecrets, ['PLANUZE_PUBLISH_TOKEN', 'PLANUZE_SIGNING_KEY']);
  assert.match(readme, /publisher não precisa pertencer à\s+organização Planuze/);
  assert.match(readme, /não habilite acesso ao repositório privado do CMS/);
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
  assert.match(readme, /@planuze\/pack-publisher@0\.4\.7/);
  assert.doesNotMatch(readme, /@planuze\/pack-publisher@(?:latest|0\.4\.[0-6])/);
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
  assert.match(readme, /--kind template\|extension\|module-pack/);
  assert.match(readme, /tag exata `v<manifest\.version>`/);
  assert.doesNotMatch(readme, /<40_CHAR_COMMIT_SHA>|@planuze\/pack-publisher@0\.3\.3/);
  assert.match(readme, /PLANUZE_REGISTRY_URL` não precisa ser criada em nenhum provider/);
  assert.match(readme, /https:\/\/registry\.planuze\.com\/v1/);
  assert.match(readme, /GitHub, GitLab e Bitbucket usam o\s+mesmo contrato provider-neutral/);
  assert.match(readme, /configure somente os dois secrets de publicação/);
  assert.ok(yamlBlocks.length >= 3);
  for (const yaml of yamlBlocks) {
    assert.doesNotMatch(yaml, /PLANUZE_REGISTRY_URL|SCAN_RUNNER_URL/);
  }
});
