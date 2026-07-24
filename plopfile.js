/* Plop scaffolder — cria um novo MÓDULO neste pack a partir de templates.
 *
 * Uso:
 *   npm run scaffold          # ou: npx plop module
 *   > Module id (kebab-case): mailer
 *
 * Gera:
 *   base/<id>/service.ts.tpl   base/<id>/index.ts.tpl   base/<id>/README.md.tpl
 *   docs/pt-BR/<id>.md         docs/en-US/<id>.md
 *   .scaffold/<id>.md          (snippet de manifest + locale para você colar)
 *
 * O generator (generator/steps/render.js) lê TODOS os `.tpl` de `base/<id>/`,
 * então o novo módulo já é renderizável — falta só declará-lo no manifest.json e
 * nos locales (o snippet em .scaffold/<id>.md tem o que colar).
 *
 * Os `.tpl` contêm tokens do PACK (`{{module}}`, `{{MODULE}}`) que devem chegar
 * ao disco LITERAIS — por isso os templates os envolvem em `{{{{raw}}}}` (bloco
 * raw do Handlebars) para o Plop não tentar resolvê-los.
 */

// biome-ignore lint/style/noDefaultExport: plopfile requer export default (interface Plop)
export default function (plop) {
  plop.setGenerator('module', {
    description: 'Scaffold a new module (base templates + per-locale docs + manifest snippet)',
    prompts: [
      {
        type: 'input',
        name: 'id',
        message: 'Module id (kebab-case, ex.: mailer):',
        validate: (value) =>
          /^[a-z][a-z0-9-]*$/.test(value) || 'Use kebab-case: começa com letra, [a-z0-9-].',
      },
    ],
    actions: [
      {
        type: 'add',
        path: 'base/{{dashCase id}}/service.ts.tpl',
        templateFile: 'plop-templates/module/service.ts.tpl.hbs',
      },
      {
        type: 'add',
        path: 'base/{{dashCase id}}/index.ts.tpl',
        templateFile: 'plop-templates/module/index.ts.tpl.hbs',
      },
      {
        type: 'add',
        path: 'base/{{dashCase id}}/README.md.tpl',
        templateFile: 'plop-templates/module/README.md.tpl.hbs',
      },
      {
        type: 'add',
        path: 'docs/pt-BR/{{dashCase id}}.md',
        templateFile: 'plop-templates/module/doc.pt.md.hbs',
      },
      {
        type: 'add',
        path: 'docs/en-US/{{dashCase id}}.md',
        templateFile: 'plop-templates/module/doc.en.md.hbs',
      },
      {
        type: 'add',
        path: '.scaffold/{{dashCase id}}.md',
        templateFile: 'plop-templates/module/snippet.md.hbs',
      },
      () =>
        'Módulo criado. Cole o snippet de .scaffold/<id>.md no manifest.json + locales/*.json, e rode `npm run check:docs`.',
    ],
  });
}
