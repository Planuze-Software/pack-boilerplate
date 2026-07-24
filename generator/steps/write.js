/* Step `write`.
 *
 * Persiste os arquivos renderizados dentro do módulo alvo do projeto. O destino
 * de um module-pack é `<MODULE_PATH>/<moduleId>/` — o app passa `MODULE_PATH`
 * apontando para a pasta de config do módulo escolhido pelo usuário na
 * instalação. Todo write passa por `writeSafeFile` (path-safety).
 */
import { safeChildPath, writeSafeFile } from '../helpers/path-safety.js';
import { stepLog } from '../helpers/emit-event.js';

export async function writeModuleFiles(ctx, moduleId, files) {
  if (ctx.modulePath === undefined) {
    stepLog(`scaffold-${moduleId}`, 'warn', 'packs.hello_service.logs.module_path_missing');
    return;
  }
  for (const file of files) {
    const targetPath = await safeChildPath(ctx.modulePath, [moduleId, file.outName], {
      createBase: true,
    });
    await writeSafeFile(targetPath, file.content);
    stepLog(`scaffold-${moduleId}`, 'info', 'packs.hello_service.logs.file_written', {
      file: file.outName,
    });
  }
}
