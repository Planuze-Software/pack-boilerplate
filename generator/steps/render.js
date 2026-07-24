/* Step `render`.
 *
 * Lê todos os `.tpl` de `base/<moduleId>/`, resolve as variáveis do template
 * (nome do módulo alvo + props do manifest em snake_case) e devolve o conteúdo
 * já renderizado. NÃO escreve nada — separar render de write torna o pipeline
 * testável (render é pura: templates + vars → arquivos em memória).
 */
import { readdir, readFile } from 'node:fs/promises';
import { renderTemplate, snakeCaseKeys } from '../helpers/handlebars-render.js';
import { safeChildPath } from '../helpers/path-safety.js';

const TPL_SUFFIX = '.tpl';

export async function renderModuleFiles(ctx, moduleId) {
  const templateDir = await safeChildPath(ctx.packDir, ['base', moduleId]);
  const entries = await readdir(templateDir, { withFileTypes: true }).catch(() => []);
  const templates = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(TPL_SUFFIX))
    .map((entry) => entry.name);

  /* Props do módulo (coletadas no wizard de install) chegam com as chaves do
     manifest (kebab-case); os placeholders usam snake_case. `module` é o nome
     do módulo ALVO no projeto (não o id deste pack). */
  const props = ctx.modelProps[moduleId] ?? ctx.moduleProps;
  const vars = { module: ctx.moduleId, ...snakeCaseKeys(props) };

  const files = [];
  for (const templateName of templates) {
    const sourcePath = await safeChildPath(ctx.packDir, ['base', moduleId, templateName]);
    const content = await readFile(sourcePath, 'utf8');
    files.push({
      outName: templateName.slice(0, -TPL_SUFFIX.length),
      content: renderTemplate(content, vars),
    });
  }
  return files;
}
