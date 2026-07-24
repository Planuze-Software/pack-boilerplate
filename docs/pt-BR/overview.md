# Hello Service — pack de exemplo (boilerplate)

O **Hello Service** é um **module-pack de exemplo** do Planuze. Ele adiciona um
serviço de saudação (`greet`) a um projeto **NEP** (Node + Express + Prisma +
TypeScript) e existe para servir de **ponto de partida** a quem quer construir o
próprio pack: manifest, generator, agente, docs, base e locales — todos mínimos,
reais e coerentes.

> [!NOTE]
> Este documento é o **overview do pack** (renderizado no app quando o usuário
> abre a doc). A doc do módulo `greeter` vive em `docs/<locale>/greeter.md` e traz
> o detalhe de capacidades, exemplos e troubleshooting.

---

## 1. O que faz

- Gera `greeter/greet.ts` no módulo alvo escolhido pelo usuário: um helper
  `greet({ name })` que retorna `Result<{ message }, GreetError>` (neverthrow).
- Declara `zod` + `neverthrow` como `runtimeDeps.common` — o step `install-deps`
  as injeta no `package.json` do projeto.
- Traz um **agente** que configura o serviço e **fia a chamada** de `greet` onde
  ela é usada (para não deixar código morto).

## 2. Como funciona

O pack roda como um **subprocesso Node** que fala NDJSON com o app e escreve os
arquivos no projeto. A geração tem duas etapas:

```mermaid
flowchart TD
  M[manifest.json<br/>runtimeDeps + modules] --> ID[step: install-deps<br/>zod + neverthrow no package.json]
  ID --> SC[step: scaffold-greeter<br/>render base/greeter/*.tpl]
  SC --> G[greeter/greet.ts<br/>greet() + schema + erros]
  SC --> BR[greeter/index.ts<br/>barrel]
  G -. você chama .-> CALL[rota / evento / job]
  G -. se ninguém chama .-> DEAD[["código morto"]]
```

> [!TIP]
> O generator é standalone: você consegue rodá-lo com `node` puro
> (`npm run test` roda um smoke que gera o módulo num diretório temporário).

## 3. Exemplos

```ts
import { greet } from './greeter/index.js';

const r = greet({ name: 'Ana' });
if (r.isErr()) {
  // trate por tipo — a união é discriminada
  return reply.status(400).send({ error: r.error.kind });
}
console.log(r.value.message); // "Hello, Ana!"
```

## 4. Integração — e o alerta de código morto

> [!WARNING]
> Instalar o pack cria `greet.ts`, mas **nada o chama automaticamente**. `greet`
> só produz saudação quando você o invoca num call-site. Use o agente
> **Hello Service** (starter *"Fiar greet() onde é usado"*) para detectar e fiar a
> chamada.

<details>
<summary>Anatomia deste pack (o que copiar no seu)</summary>

| Pasta / arquivo | Papel |
|---|---|
| `manifest.json` | Metadados + `kind`, `appliesTo`, `distribution`, `modules`, `generator`. |
| `generator/` | Entrypoint NDJSON + helpers (`emit-event`, `handlebars-render`, `path-safety`) + steps (`init`/`render`/`write`). |
| `base/greeter/` | Templates `.tpl` renderizados no projeto. |
| `agent/` | `agents.json` + `rules/` + `description/` — assiste E executa a integração. |
| `docs/<locale>/` | Docs por locale (este arquivo + um por módulo). |
| `locales/` | Catálogo i18n com **toda** `labelKey` do manifest. |

</details>

## 5. Troubleshooting

| Sintoma | Causa provável | Ação |
|---|---|---|
| `greet` "não faz nada" | Ninguém o chama | É código morto — fie a chamada (veja seção 4). |
| Saudação sem assinatura | `HELLO_{MODULE}_SIGNATURE` vazio | Setar a env no `.env` do projeto. |
| Lint reclama de `labelKey` | Chave ausente no locale | Adicione a chave em **todos** os `locales/*.json`. |
| Doc "não aparece" no app | Doc faltando por locale | Garanta `docs/<locale>/<doc>` + fallback `en-US`. |
