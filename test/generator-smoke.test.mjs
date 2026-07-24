/* Smoke test do generator — zero dependências (node:test + node:assert).
 *
 * Roda o generator como o app faria: seta as env vars, spawna
 * `node generator/index.js scaffold greeter` e verifica que:
 *   - os eventos NDJSON são emitidos com o schema correto (`type:`);
 *   - o arquivo `greeter/greet.ts` é escrito no diretório do módulo alvo;
 *   - os placeholders `{{module}}` / `{{MODULE}}` / `{{greeting_text}}` foram
 *     renderizados.
 *
 * Executar: `npm test` (ou `node --test test/*.test.mjs`).
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';

const packDir = dirname(dirname(fileURLToPath(import.meta.url)));
const workspaces = [];

async function makeTempDir(prefix) {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  workspaces.push(dir);
  return dir;
}

function runGenerator(env) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [join(packDir, 'generator', 'index.js'), 'scaffold', 'greeter'], {
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'inherit'],
    });
    let stdout = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout }));
    child.stdin.end('{}');
  });
}

after(async () => {
  await Promise.all(workspaces.map((dir) => rm(dir, { recursive: true, force: true })));
});

test('scaffold greeter renders greet.ts into the target module', async () => {
  const modulePath = await makeTempDir('hello-module-');
  const projectPath = await makeTempDir('hello-project-');

  const { code, stdout } = await runGenerator({
    PLANUZE_PACK_DIR: packDir,
    PLANUZE_PROJECT_PATH: projectPath,
    PLANUZE_MODULE_PATH: modulePath,
    PLANUZE_MODULE_ID: 'checkout',
    PLANUZE_ACTIVE_MODULES: JSON.stringify(['greeter']),
    PLANUZE_MODEL_PROPS: JSON.stringify({ greeter: { 'greeting-text': 'Olá' } }),
  });

  assert.equal(code, 0, 'generator should exit 0');

  const events = stdout
    .trim()
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line));

  assert.ok(
    events.some((e) => e.type === 'step.started' && e.stepId === 'scaffold-greeter'),
    'should emit step.started for scaffold-greeter',
  );
  assert.ok(
    events.some((e) => e.type === 'step.completed' && typeof e.durationMs === 'number'),
    'step.completed must carry durationMs',
  );
  assert.ok(
    events.some((e) => e.type === 'run.finished' && e.ok === true),
    'should finish ok',
  );

  const generated = await readFile(join(modulePath, 'greeter', 'greet.ts'), 'utf8');
  assert.match(generated, /Módulo alvo: checkout/, '{{module}} should be rendered');
  assert.match(generated, /HELLO_CHECKOUT_SIGNATURE/, '{{MODULE}} should be uppercased');
  assert.match(generated, /const GREETING = 'Olá';/, '{{greeting_text}} should be rendered');
});
