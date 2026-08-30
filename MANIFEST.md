# `manifest.json` — referência de campos

JSON não aceita comentários, então este arquivo documenta **cada campo** do
`manifest.json`. Ele é o contrato entre o seu pack e a plataforma: o editor, o
generator engine e o marketplace leem tudo daqui. O schema canônico é
`packManifestSchema` (pack-format); o que segue reflete esse schema.

> Legenda: **[obrigatório]** / **[opcional]** / **[default: x]**.

---

## Identidade e tipo

| Campo | Regra | Descrição |
|---|---|---|
| `kind` | **[default: template]** `template` \| `extension` \| `module-pack` | Como o pack instala. Ver [Os três kinds](#os-três-kinds). |
| `id` | **[obrigatório]** slug (aceita escopo `scope/nome`) | ID único do pack (ex.: `acme/hello-service`). Não pode ser um nome reservado (`planuze`, `core`, `auth`, `api`, ...). |
| `name` | **[obrigatório]** string | Nome npm-like (ex.: `@acme/pack-hello-service`). |
| `version` | **[obrigatório]** semver | Versão do pack. A tag git `v<version>` dispara o publish. |
| `labelKey` | **[obrigatório]** chave i18n | Nome exibido — resolvido via `locales/*.json`. **Precisa existir em todos os locales.** |
| `descriptionKey` | **[opcional]** chave i18n | Descrição exibida. Se presente, precisa existir nos locales. |
| `doc` | **[opcional]** nome de arquivo | Doc de overview: resolvida em `docs/<locale>/<doc>` com fallback `en-US`. Declarar `doc` **exige** o arquivo por locale (gate ADR-0723). |

### `appliesTo` (**obrigatório** para `extension`/`module-pack`; **proibido** para `template`)

```json
"appliesTo": { "packId": "planuze/nep", "minVersion": "1.0.0", "maxVersion": "1.x" }
```

- `packId` — ID do template parent que este pack estende (não pode ser igual ao `id`).
- `minVersion` / `maxVersion` — range compatível (`1.0.0`, `1.x`, `1.2.x`).

---

## Os três kinds

| kind | Instala em | Quando usar |
|---|---|---|
| `template` | raiz do projeto (scaffold do zero) | Um stack completo (ex.: `nep` = Node+Express+Prisma). Declara `wizard`, `toolkit`, `declarations`. |
| `extension` | `src/modules/<id>/` (um módulo top-level novo) | Capability transversal em pasta própria (ex.: `observability`). |
| `module-pack` | `src/modules/<alvo>/_pkgs/<id>/` (dentro de um módulo existente) | Capability consumida por um módulo específico (ex.: `nep-auth`, `nep-sms`, e este `hello-service`). O usuário escolhe o módulo alvo na instalação. |

`extension` e `module-pack` **não** declaram `wizard` (rodam pós-scaffold) e **exigem** `appliesTo`.

---

## `author`, `stack`, `distribution`

```json
"author":  { "name": "Acme", "email": "packs@acme.example", "url": "https://acme.example" }
"stack":   { "minAppVersion": "0.0.13", "runtimeVersion": 1, "requires": ["runtime.node", "fs.write"] }
```

- `stack.minAppVersion` — menor versão do app capaz de instalar o pack. O
  boilerplate acompanha o runtime vigente (`0.0.13`); aumente somente quando usar
  um contrato lançado depois dele.
- `stack.runtimeVersion` — **sempre `1`** (versão do runtime de packs).
- `stack.requires` — capabilities dotted-id necessárias. Declare o que o source
  realmente usa: este generator executa Node e grava arquivos, então exige
  `runtime.node` e `fs.write`. O scanner compara o código a esta lista.

### `distribution` (o que controla monetização/visibilidade)

| Campo | Regra | Descrição |
|---|---|---|
| `license` | **[obrigatório]** `free` \| `paid` \| `private` | Modelo de licença. |
| `channels` | **[obrigatório]** `stable`/`beta`/`canary` | Canais de release. |
| `tier` | **[default: free]** `free`/`pro`/`team`/`enterprise` | Tier de plano onde entra por assinatura. |
| `priceUsd` | **[opcional]** número ≥ 0 | Preço informativo (o preço real vem do config-service). |
| `requiredCapabilities` | **[default: []]** | Capabilities exigidas para inclusão por assinatura (gate = capability, não tier ordinal). |
| `requiresParentEntitlement` | **[default: true]** | Extension/module-pack exige que o usuário tenha o entitlement do template parent. |
| `visibility` | **[default: public]** `public`/`org-private`/`byMyself` | Visibilidade no marketplace. `org-private` exige `allowedOrgs[]`. |
| `category` / `tags` | **[opcional]** | Descoberta no marketplace (o registry valida contra a taxonomia canônica no publish). |

> A assinatura Ed25519 garante o **conteúdo**. A `visibility` e a moderação são
> controle de **servidor** (metadata mutável): o valor no manifest é só o inicial.

---

## `runtimeDeps` — deps do PROJETO gerado

```json
"runtimeDeps": {
  "common":  { "zod": "^3.23.8", "neverthrow": "^7.2.0" },
  "byModule": { "twilio": { "twilio": "^5.2.3" } }
}
```

Deps npm que o **step `install-deps`** injeta no `package.json` do projeto do
usuário. `common` = sempre; `byModule[<id>]` = só quando o módulo está ativo.
`@types/*` vão para `devDependencies`. **Sem este campo, o projeto scaffolda sem
as libs e quebra em runtime.**

---

## `declarations` e `toolkit` (sobretudo em `template`)

- `declarations` — vocabulário que o pack ENSINA à plataforma: `columnTypes`,
  `relationTypes`, `routeTypes`, `validatorMethods` (+ `lambdaTypes`/`triggers`/
  `integrations`/`iamPolicies` para packs non-CRUD). Um `validatorMethod.appliesTo`
  precisa referenciar um `columnType` declarado no mesmo manifest (em template).
- `toolkit` — o que o EDITOR oferece ao usuário: `columnTypes` (com `mapsTo`),
  `validators`, `routeTypes` (com `capabilities`), `whereOperators`,
  `defaultColumns`, etc.

Um `module-pack` simples (como este) mantém `declarations` **vazio** — ele só gera
código, não ensina tipos novos ao editor.

---

## `modules[]` — sub-features ativáveis por projeto

```json
{
  "id": "greeter",
  "labelKey": "...", "descriptionKey": "...", "doc": "greeter.md",
  "default": true,
  "props":   [ { "key": "greeting-text", "labelKey": "...", "descriptionKey": "...", "kind": "text", "required": false, "defaultValue": "Hello" } ],
  "envVars": [ { "key": "HELLO_{MODULE}_SIGNATURE", "default": "", "description": "..." } ],
  "declarations": { "columnTypes": [], "relationTypes": [], "routeTypes": [], "validatorMethods": [] },
  "steps":   [ { "id": "scaffold-greeter", "labelKey": "...", "command": "node generator/index.js scaffold greeter", "dependsOn": ["install-deps"] } ]
}
```

- `props[].key` — kebab-case; o generator normaliza para snake_case nos templates.
- `envVars[].key` — suporta `{MODULE}` (upper) / `{module}` (lower) para namespace.
- `doc` — se presente, **exige** `docs/<locale>/<doc>` por locale + fallback.
- `default` — vem marcado no wizard de install.

---

## `generator` — pipeline do subprocesso

```json
"generator": {
  "entrypoint": "generator/index.js",
  "steps": [ { "id": "install-deps", "labelKey": "...", "command": "node generator/index.js install-deps", "dependsOn": [] } ]
}
```

- `entrypoint` — arquivo Node standalone que fala NDJSON (o lint verifica que existe).
- `steps[].dependsOn` — ordering explícito; `condition` (opcional) gateia o step por capability; `postCreateCommands` (opcional) roda após o scaffold.

---

## `agent` (opcional) e actions

```json
"agent": { "entrypoint": "agent/description/index.md", "workflowIds": [] }
```

- Declarar `agent` inclui o entrypoint e o diretório `agent/` no `.plnzpack`.
  Manter arquivos em `agent/` sem este campo não habilita o agente.
- `actions` / `collectionActions` / `moduleActions` / `projectActions` — botões que
  o app expõe (rodam step do pack ou comando shell). Mantenha `[]` se não usar.

---

## Assinatura (preenchida pelo build)

| Campo | Descrição |
|---|---|
| `publicKeyFingerprint` | No manifest-fonte deve ser **exatamente** `sha256:` + 64 zeros. O build atestado deriva a chave pública e injeta a fingerprint real somente no artefato. |
| `signatureAlgorithm` | Sempre `ed25519`. |
| `publisherFingerprint` | Não declare no manifest-fonte. O build atestado injeta a fingerprint real no artefato para a cadeia de confiança do publisher. |

> O source precisa manter `sha256:0000000000000000000000000000000000000000000000000000000000000000`.
> Não copie para ele a fingerprint exibida por `keygen` ou pelo Portal. O gate
> `npm run check:source-manifest` bloqueia qualquer outro valor; o build atestado
> injeta a fingerprint real e o registry resolve e valida a chave registrada.
