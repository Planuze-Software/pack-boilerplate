# Hello Service — example pack (boilerplate)

**Hello Service** is an **example module-pack** for Planuze. It adds a greeting
service (`greet`) to a **NEP** project (Node + Express + Prisma + TypeScript) and
exists to be a **starting point** for anyone building their own pack: manifest,
generator, agent, docs, base and locales — all minimal, real and coherent.

> [!NOTE]
> This document is the **pack overview** (rendered in the app when the user opens
> the docs). The `greeter` module doc lives at `docs/<locale>/greeter.md` and
> carries the detail of capabilities, examples and troubleshooting.

---

## 1. What it does

- Generates `greeter/greet.ts` into the target module the user picks: a `greet({
  name })` helper returning `Result<{ message }, GreetError>` (neverthrow).
- Declares `zod` + `neverthrow` as `runtimeDeps.common` — the `install-deps` step
  injects them into the project `package.json`.
- Ships an **agent** that configures the service and **wires the `greet` call**
  where it is used (so no dead code is left behind).

## 2. How it works

The pack runs as a **Node subprocess** that speaks NDJSON to the app and writes
files into the project. Generation has two stages:

```mermaid
flowchart TD
  M[manifest.json<br/>runtimeDeps + modules] --> ID[step: install-deps<br/>zod + neverthrow in package.json]
  ID --> SC[step: scaffold-greeter<br/>render base/greeter/*.tpl]
  SC --> G[greeter/greet.ts<br/>greet() + schema + errors]
  SC --> BR[greeter/index.ts<br/>barrel]
  G -. you call .-> CALL[route / event / job]
  G -. if nobody calls .-> DEAD[["dead code"]]
```

> [!TIP]
> The generator is standalone: you can run it with plain `node`
> (`npm run test` runs a smoke that generates the module into a temp directory).

## 3. Examples

```ts
import { greet } from './greeter/index.js';

const r = greet({ name: 'Ann' });
if (r.isErr()) {
  // handle by type — the union is discriminated
  return reply.status(400).send({ error: r.error.kind });
}
console.log(r.value.message); // "Hello, Ann!"
```

## 4. Integration — and the dead-code warning

> [!WARNING]
> Installing the pack creates `greet.ts`, but **nothing calls it automatically**.
> `greet` only produces a greeting when you invoke it at a call-site. Use the
> **Hello Service** agent (starter *"Wire greet() where it's used"*) to detect and
> wire the call.

<details>
<summary>Anatomy of this pack (what to copy into yours)</summary>

| Folder / file | Role |
|---|---|
| `manifest.json` | Metadata + `kind`, `appliesTo`, `distribution`, `modules`, `generator`. |
| `generator/` | NDJSON entrypoint + helpers (`emit-event`, `handlebars-render`, `path-safety`) + steps (`init`/`render`/`write`). |
| `base/greeter/` | `.tpl` templates rendered into the project. |
| `agent/` | `agents.json` + `rules/` + `description/` — assists AND executes the integration. |
| `docs/<locale>/` | Per-locale docs (this file + one per module). |
| `locales/` | i18n catalog with **every** manifest `labelKey`. |

</details>

## 5. Troubleshooting

| Symptom | Likely cause | Action |
|---|---|---|
| `greet` "does nothing" | Nobody calls it | It's dead code — wire the call (see section 4). |
| Greeting has no signature | `HELLO_{MODULE}_SIGNATURE` empty | Set the env in the project `.env`. |
| Lint complains about `labelKey` | Key missing in a locale | Add the key to **every** `locales/*.json`. |
| Doc "doesn't show" in the app | Doc missing per locale | Ensure `docs/<locale>/<doc>` + the `en-US` fallback. |
