/* Step `init` / `install-deps`.
 *
 * Lê `runtimeDeps` do manifest e as injeta no `package.json` do PROJETO do
 * usuário (não instala aqui — só declara; o app/usuário roda o install). Deps
 * `common` entram sempre; `byModule[<id>]` entram por módulo ativo. `@types/*`
 * vão para devDependencies.
 */
import { readFile } from 'node:fs/promises';
import { safeChildPath, writeSafeFile } from '../helpers/path-safety.js';
import { parseJson } from '../helpers/handlebars-render.js';
import { stepLog } from '../helpers/emit-event.js';

const sortKeys = (obj) =>
  Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));

export async function installDeps(ctx) {
  const manifestPath = await safeChildPath(ctx.packDir, ['manifest.json']);
  const manifest = parseJson(await readFile(manifestPath, 'utf8').catch(() => null), null);
  if (manifest === null) {
    stepLog('install-deps', 'warn', 'packs.hello_service.logs.manifest_missing');
    return;
  }

  const runtimeDeps = manifest.runtimeDeps ?? {};
  const depsToAdd = { ...(runtimeDeps.common ?? {}) };
  for (const moduleId of ctx.activeModules) {
    Object.assign(depsToAdd, runtimeDeps.byModule?.[moduleId] ?? {});
  }
  if (Object.keys(depsToAdd).length === 0) {
    stepLog('install-deps', 'info', 'packs.hello_service.logs.deps_empty');
    return;
  }

  const pkgPath = await safeChildPath(ctx.projectPath, ['package.json']);
  const projectPkg = parseJson(await readFile(pkgPath, 'utf8').catch(() => null), null);
  if (projectPkg === null) {
    stepLog('install-deps', 'warn', 'packs.hello_service.logs.project_package_missing');
    return;
  }

  const dependencies = { ...(projectPkg.dependencies ?? {}) };
  const devDependencies = { ...(projectPkg.devDependencies ?? {}) };
  let added = 0;
  for (const [name, version] of Object.entries(depsToAdd)) {
    const target = name.startsWith('@types/') ? devDependencies : dependencies;
    if (target[name] !== version) {
      target[name] = version;
      added += 1;
    }
  }

  const next = {
    ...projectPkg,
    ...(Object.keys(dependencies).length > 0 && { dependencies: sortKeys(dependencies) }),
    ...(Object.keys(devDependencies).length > 0 && { devDependencies: sortKeys(devDependencies) }),
  };
  await writeSafeFile(pkgPath, `${JSON.stringify(next, null, 2)}\n`);
  stepLog('install-deps', 'info', 'packs.hello_service.logs.deps_updated', { count: added });
}
