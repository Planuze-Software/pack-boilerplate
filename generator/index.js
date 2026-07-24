#!/usr/bin/env node
/**
 * Generator do pack `acme/hello-service` (module-pack de exemplo).
 *
 * Contrato (idêntico aos packs oficiais):
 *   - Subprocesso Node standalone: `node generator/index.js [step] [module]`.
 *   - Lê o payload de config na 1ª linha do stdin (JSON) — aqui não usamos o
 *     conteúdo, mas drenamos o stdin para não travar.
 *   - Fala com o app via NDJSON em stdout (ver helpers/emit-event.js).
 *   - Toda config vem por env var (o app as injeta):
 *       PLANUZE_PACK_DIR        raiz deste pack
 *       PLANUZE_PROJECT_PATH    raiz do projeto do usuário
 *       PLANUZE_MODULE_PATH     pasta de config do módulo alvo (destino do scaffold)
 *       PLANUZE_MODULE_ID       nome do módulo alvo no projeto
 *       PLANUZE_ACTIVE_MODULES  JSON array de módulos deste pack ativados
 *       PLANUZE_MODEL_PROPS     JSON { <moduleId>: { <propKey>: value } }
 *       PLANUZE_MODULE_PROPS    JSON flat de props (fallback p/ invocação manual)
 *
 * Steps:
 *   (sem args) | install-deps   → install-deps + scaffold de todos os módulos ativos
 *   scaffold <module>           → scaffold de UM módulo (render + write)
 */
import { installDeps } from './steps/init.js';
import { renderModuleFiles } from './steps/render.js';
import { writeModuleFiles } from './steps/write.js';
import { parseJson } from './helpers/handlebars-render.js';
import { now, runFinished, stepCompleted, stepFailed, stepStarted } from './helpers/emit-event.js';

const ALLOWED_MODULES = new Set(['greeter']);

function buildContext() {
  const active = parseJson(process.env.PLANUZE_ACTIVE_MODULES, []);
  return {
    packDir: process.env.PLANUZE_PACK_DIR ?? process.cwd(),
    projectPath: process.env.PLANUZE_PROJECT_PATH ?? process.cwd(),
    modulePath: process.env.PLANUZE_MODULE_PATH,
    moduleId: process.env.PLANUZE_MODULE_ID ?? 'default',
    activeModules: Array.isArray(active)
      ? active.filter((m) => typeof m === 'string' && ALLOWED_MODULES.has(m))
      : [],
    modelProps: parseJson(process.env.PLANUZE_MODEL_PROPS, {}),
    moduleProps: parseJson(process.env.PLANUZE_MODULE_PROPS, {}),
  };
}

function drainStdin() {
  return new Promise((resolve) => {
    let buffer = '';
    process.stdin.on('data', (chunk) => {
      buffer += chunk;
    });
    process.stdin.on('end', () => resolve(parseJson(buffer, {})));
    /* Se não houver stdin (invocação manual em TTY), não trave. */
    if (process.stdin.isTTY) resolve({});
  });
}

async function scaffoldModule(ctx, moduleId) {
  const startedAt = now();
  stepStarted(`scaffold-${moduleId}`);
  const files = await renderModuleFiles(ctx, moduleId);
  await writeModuleFiles(ctx, moduleId, files);
  stepCompleted(`scaffold-${moduleId}`, startedAt);
}

async function runInstall(ctx) {
  const startedAt = now();
  stepStarted('install-deps');
  await installDeps(ctx);
  stepCompleted('install-deps', startedAt);
  for (const moduleId of ctx.activeModules) {
    await scaffoldModule(ctx, moduleId);
  }
}

async function main() {
  await drainStdin().catch(() => ({}));
  const ctx = buildContext();
  const step = process.argv[2] ?? 'install-deps';
  const moduleArg = process.argv[3];
  try {
    if (process.argv.length <= 2 || step === 'install-deps') {
      await runInstall(ctx);
    } else if (step === 'scaffold' && moduleArg !== undefined && ALLOWED_MODULES.has(moduleArg)) {
      await scaffoldModule(ctx, moduleArg);
    } else {
      stepFailed(step, `unknown_step:${step}:${moduleArg ?? ''}`);
      runFinished(false, ctx.projectPath);
      process.exit(1);
    }
    runFinished(true, ctx.projectPath);
  } catch (error) {
    stepFailed(step, error instanceof Error ? error.message : 'generator_failed');
    runFinished(false, ctx.projectPath);
    process.exit(1);
  }
}

main();
