# Planuze Pack Boilerplate

Ponto de partida **cloável** para construir um pack do Planuze. Clone, renomeie,
implemente, teste e publique — sem começar de uma folha em branco.

Este repositório **é** um pack funcional de exemplo (`acme/hello-service`, um
`module-pack` que gera um serviço de saudação para projetos NEP). Cada peça é
mínima, real e coerente com os gates da plataforma (schema do manifest, gate de
docs por-locale, gate de locales, contrato NDJSON do generator, assinatura
Ed25519 no publish).

> [!TIP]
> Leia o `manifest.json` + `MANIFEST.md` lado a lado. O `MANIFEST.md` documenta
> **cada campo** (JSON não aceita comentário).

---

## Índice

1. [O que é um pack](#1-o-que-é-um-pack)
2. [template vs extension vs module-pack](#2-template-vs-extension-vs-module-pack)
3. [Anatomia do repositório](#3-anatomia-do-repositório)
4. [Como o generator roda](#4-como-o-generator-roda)
5. [O agente de integração (e o "código morto")](#5-o-agente-de-integração-e-o-código-morto)
6. [Docs ricas (recursos do renderer)](#6-docs-ricas-recursos-do-renderer)
7. [i18n / locales](#7-i18n--locales)
8. [Passo a passo: clone → renomeie → implemente → teste → publique](#8-passo-a-passo-clone--renomeie--implemente--teste--publique)
9. [Publicação (CI/CD-first)](#9-publicação-cicd-first)
10. [Moderação, verified e entitlement](#10-moderação-verified-e-entitlement)
11. [Referência de comandos da CLI](#11-referência-de-comandos-da-cli)

---

## 1. O que é um pack

Um pack é uma unidade instalável que **estende a plataforma via manifest
declarativo** e **gera código** no projeto do usuário. A plataforma é um
*toolkit, não um framework*: ela lê o `manifest.json` e nunca hardcoda o
vocabulário do pack. Em runtime, o pack roda um **generator** (subprocesso Node)
que escreve arquivos no projeto, e pode trazer um **agente** de IA que assiste e
executa integrações.

Um pack é distribuído como um arquivo `.plnzpack`: um bundle **assinado**
(Ed25519) e cifrado (XChaCha20-Poly1305), com layout normativo. Você nunca monta
esse arquivo à mão — o `@planuze/pack-publisher` faz o `pack build`.

---

## 2. template vs extension vs module-pack

O campo `kind` do manifest decide **onde** o pack instala e **o que** ele declara.

| kind | Instala em | Declara `wizard`/`toolkit`? | `appliesTo`? | Exemplo |
|---|---|---|---|---|
| `template` | raiz do projeto | Sim (é o stack base) | **proibido** | `nep` (Node+Express+Prisma) |
| `extension` | `src/modules/<id>/` (módulo novo) | não | **obrigatório** | `aws-lambdas` |
| `module-pack` | `src/modules/<alvo>/_pkgs/<id>/` | não | **obrigatório** | `nep-auth`, `nep-sms`, **este** `hello-service` |

- Um **template** é um projeto inteiro: ensina tipos de coluna/rota/validator ao
  editor (`declarations` + `toolkit`) e coleta config no `wizard`.
- Uma **extension** cria um módulo top-level próprio — capability transversal.
- Um **module-pack** injeta uma capability DENTRO de um módulo que o usuário
  escolhe na instalação (auth/email/sms/…). É o kind mais comum para add-ons.

Este boilerplate é um `module-pack` porque é o caso mais didático: manifest
enxuto, generator pequeno, e o ponto crucial do **wiring / código morto** fica
explícito.

---

## 3. Anatomia do repositório

```text
pack-boilerplate/
├── manifest.json              # contrato: kind, appliesTo, distribution, modules, generator
├── MANIFEST.md                # referência campo-a-campo do manifest
├── package.json               # scripts (lint/test/build/sign/publish) + plop
├── README.md                  # este guia
├── CHANGELOG.md               # histórico (Keep a Changelog)
├── LICENSE                    # MIT (placeholder)
├── .gitignore                 # node_modules, dist, *.plnzpack, *.pem, .scaffold
├── generator/
│   ├── index.js               # entrypoint NDJSON (dispatch de steps)
│   ├── helpers/
│   │   ├── emit-event.js       # eventos NDJSON (type:, durationMs, …)
│   │   ├── handlebars-render.js# render {{token}} minimalista + snakeCaseKeys
│   │   └── path-safety.js      # safeChildPath / writeSafeFile (anti path-traversal)
│   └── steps/
│       ├── init.js             # step install-deps (injeta runtimeDeps no projeto)
│       ├── render.js           # lê base/<mod>/*.tpl e renderiza (puro)
│       └── write.js            # persiste no módulo alvo com path-safety
├── base/
│   └── greeter/                # templates .tpl renderizados no projeto
│       ├── greet.ts.tpl
│       ├── index.ts.tpl
│       └── README.md.tpl
├── agent/
│   ├── agents.json             # agente(s): assiste E executa a integração
│   ├── rules/default.md        # regras (inclui "não deixe código morto")
│   └── description/index.md    # entrypoint da doc do agente
├── docs/
│   ├── pt-BR/{overview,greeter}.md
│   └── en-US/{overview,greeter}.md
├── locales/
│   ├── pt-BR.json              # TODA labelKey do manifest
│   └── en-US.json
├── scripts/
│   └── check-docs.mjs          # gate de docs standalone (espelha check-pack-docs)
├── test/
│   └── generator-smoke.test.mjs# smoke: roda o generator num dir temporário
├── plopfile.js                 # scaffolder de novo módulo
├── plop-templates/module/       # templates do scaffolder
└── .github/workflows/ci.yml    # lint + docs + smoke + (em tag) sign/publish
```

> **Onde ficam os templates?** Este boilerplate lê os `.tpl` de `base/<módulo>/`.
> Alguns packs oficiais (ex.: `nep-sms`) usam `generator/templates/<provider>/`; o
> template do projeto inteiro (`nep`) usa `base/` com `.hbs` copiados
> write-if-missing. Escolha o que fizer sentido — o generator é quem lê.

---

## 4. Como o generator roda

O generator é um **subprocesso Node standalone**. O app (ou a CLI `pack run`) o
spawna, envia a config na **primeira linha do stdin** (JSON) e injeta o resto via
**env vars**. O generator responde escrevendo **um evento JSON por linha** em
stdout (NDJSON).

### Env vars injetadas

| Env | Significado |
|---|---|
| `PLANUZE_PACK_DIR` | raiz deste pack |
| `PLANUZE_PROJECT_PATH` | raiz do projeto do usuário |
| `PLANUZE_MODULE_PATH` | pasta de config do módulo alvo (destino do scaffold) |
| `PLANUZE_MODULE_ID` | nome do módulo alvo no projeto |
| `PLANUZE_ACTIVE_MODULES` | JSON array dos módulos deste pack ativados |
| `PLANUZE_MODEL_PROPS` | JSON `{ <moduleId>: { <propKey>: value } }` |
| `PLANUZE_MODULE_PROPS` | JSON flat de props (fallback manual) |

### Contrato de eventos (NDJSON) — use `type:`, não `kind:`

```text
{"type":"step.started","stepId":"scaffold-greeter","timestamp":...}
{"type":"step.log","stepId":"scaffold-greeter","level":"info","message":"...","messageKey":"...","messageParams":{...}}
{"type":"step.completed","stepId":"scaffold-greeter","durationMs":12,"timestamp":...}
{"type":"run.finished","ok":true}
```

> [!WARNING]
> `durationMs` é **obrigatório** em `step.completed` — sem ele o engine rejeita o
> evento e **aborta o run**. Em falha, emita `step.failed` **antes** de
> `run.finished {ok:false}`.

### Rodar manualmente (o que o smoke test faz)

```bash
PLANUZE_PACK_DIR="$PWD" \
PLANUZE_PROJECT_PATH=/tmp/proj \
PLANUZE_MODULE_PATH=/tmp/proj/src/modules/checkout/config \
PLANUZE_MODULE_ID=checkout \
PLANUZE_ACTIVE_MODULES='["greeter"]' \
PLANUZE_MODEL_PROPS='{"greeter":{"greeting-text":"Olá"}}' \
  node generator/index.js scaffold greeter <<< '{}'
```

Ou, com a CLL do Planuze: `npx @planuze/pack-publisher pack run . /tmp/proj --debug`.

### Pipeline interno (steps)

`index.js` orquestra três fases: **init** (injeta `runtimeDeps` no `package.json`
do projeto) → **render** (lê `base/<mod>/*.tpl` e renderiza — função pura) →
**write** (persiste com path-safety). Separar render de write torna o generator
testável e mantém a escrita confinada ao diretório alvo.

> [!IMPORTANT]
> O generator roda no computador do usuário. **Toda escrita passa por
> `safeChildPath`/`writeSafeFile`** (checagem lexical `..` + realpath de symlink).
> Nunca use `startsWith('${base}/')` — é POSIX-only e falha no Windows.

Precisa de Handlebars completo (partials, `{{#each}}`)? Troque
`helpers/handlebars-render.js` por `node-plop` + `handlebars` (é o que o `nep`
faz) e leia os templates via Plop.

---

## 5. O agente de integração (e o "código morto")

Um pack que só **gera** arquivos deixa o usuário na mão: o código nasce sem ser
chamado. O agente resolve isso — ele tem **duas responsabilidades, nesta ordem**:

1. **Configurar** a capability (rodar/entender o scaffold).
2. **Executar a integração** — detectar se a função gerada é consumida em algum
   call-site e, se for **código morto**, **fiar a chamada** (via `edit_file`),
   nunca só descrever.

O fluxo que padronizamos (ver `agent/agents.json` + `agent/rules/default.md`):

- `describe_project` / `grep` para mapear onde os arquivos foram gerados e se a
  função (`greet`, `sendSms`, …) já é importada/chamada.
- Se **não** é consumida → é código morto → escolher o call-site (com o usuário
  quando ambíguo) e aplicar a chamada.
- Ao terminar, **apontar explicitamente** onde a função passou a ser chamada e
  confirmar que não restou código morto.

`agents.json` é JSON com um array `agents[]`. Campos usados aqui: `slug`, `name`,
`description`, `icon`, `defaultThinking`, `deniedTools` (ex.: negar `run_bash`),
`starterPrompts[]` e `systemPrompt` (o prompt que codifica o comportamento acima).

> [!TIP]
> Deixe um starter *"Fiar X onde é usado"* — é o gatilho direto para o agente
> caçar e eliminar código morto.

---

## 6. Docs ricas (recursos do renderer)

As docs do pack são renderizadas **dentro do app**. Um pack declara `doc` no
manifest (overview) e `modules[].doc` (uma por módulo). O valor é o **nome do
arquivo**, locale-agnóstico: o app resolve `docs/<locale>/<doc>` com fallback
`docs/en-US/<doc>`.

O gate de docs (ADR-0723, espelhado em `scripts/check-docs.mjs`) exige que toda
doc declarada exista **em cada locale suportado** (derivado de `locales/*.json`)
**mais o fallback `en-US`**, e que **não seja stub** (piso de ~10 linhas de
conteúdo). Existência sozinha não passa: a doc precisa ser útil.

O renderer suporta Markdown rico:

- **Callouts** GitHub-style: `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`,
  `> [!WARNING]`, `> [!CAUTION]`.
- **Mermaid** em blocos ` ```mermaid ` (flowchart, sequenceDiagram, …).
- **Code blocks** com highlight, **tabelas**, e **`<details><summary>`** para
  conteúdo colapsável.

Estruture cada doc de módulo em **5 seções** (é o padrão dos packs oficiais):

1. O que faz e capacidades **reais** (leia do template, não invente).
2. Como funciona (generator → código gerado → runtime) — com um mermaid.
3. Exemplos de uso.
4. Integração — onde chamar + **o alerta de código morto**.
5. Troubleshooting (tabela sintoma → causa → ação).

Veja `docs/pt-BR/greeter.md` como modelo.

---

## 7. i18n / locales

Todo texto exibido usa `labelKey` (nunca string crua). Cada `labelKey` referenciada
no manifest **precisa existir em TODOS os `locales/*.json`** — o gate de locales
falha na primeira chave ausente.

- Estruture como JSON aninhado; o gate achata (`packs.hello_service.modules.greeter.name`).
- Os locais suportados = basenames de `locales/*.json`. Adicionar um idioma =
  adicionar `locales/<locale>.json` (e as docs `docs/<locale>/*`).
- `messageKey` de logs do generator (ex.: `packs.hello_service.logs.file_written`)
  não é validado pelo lint, mas coloque-o nos locales para o app traduzir.

---

## 8. Passo a passo: clone → renomeie → implemente → teste → publique

```bash
# 1. CLONE
git clone <este-repo> meu-pack && cd meu-pack
npm install                      # instala plop (devDependency)

# 2. RENOMEIE (o que mexer)
#   - manifest.json: id, name, labelKey/descriptionKey, appliesTo, modules[]
#   - locales/*.json: renomeie o namespace packs.<seu_pack>.* p/ casar as labelKeys
#   - docs/<locale>/*: reescreva overview + doc do módulo
#   - agent/*: ajuste slug/name/systemPrompt
#   - generator/index.js: ALLOWED_MODULES + base/<módulo>/ dos seus templates
#   - LICENSE: copyright; package.json: name/description

# 3. IMPLEMENTE
npx plop module                  # (opcional) scaffolda um novo módulo
#   edite base/<mod>/*.tpl com o código real que o pack deve gerar

# 4. TESTE
npm test                         # smoke do generator (gera num dir temporário)
npm run check:docs               # gate de docs por-locale
npm run lint                     # lint completo (manifest+locales+generator+docs)
npm run run:demo                 # (opcional) roda o generator sobre ./tmp/demo

# 5. PUBLIQUE (ver seção 9)
git tag v0.1.0 && git push origin v0.1.0   # dispara o workflow de publish
```

Regra de ouro ao renomear: **as `labelKey` do manifest e as chaves dos
`locales/*.json` têm que casar** — rode `npm run lint` para confirmar.

---

## 9. Publicação (CI/CD-first)

A publicação é **CI/CD-first** (ADR-0363): você não roda `publish` da sua máquina
com segredos em texto — o pipeline faz. O fluxo:

1. **Gere um keypair Ed25519** (uma vez) e **registre a pubkey** no Planuze:
   ```bash
   npx @planuze/pack-publisher pack publisher:keygen --output=.local-keys
   npx @planuze/pack-publisher pack publisher:register-key --key=.local-keys/publisher.pem
   ```
   A privada **nunca** entra no git (`.gitignore` cobre `*.pem`). Guarde-a como
   secret de CI.

2. **Crie os secrets do repositório** (Settings → Secrets and variables → Actions):
   - `PLANUZE_SIGNING_KEY` — a chave Ed25519 (PEM) registrada.
   - `PLANUZE_PUBLISH_TOKEN` — token de publish (app: Publisher → Chaves e tokens).

3. **Dispare por tag.** `.github/workflows/ci.yml` roda `verify` em todo push/PR
   (lint + docs + smoke) e, em tag `v*`, o job `publish`:
   ```yaml
   printf '%s' "${{ secrets.PLANUZE_SIGNING_KEY }}" > signing-key.pem
   npx @planuze/pack-publisher pack build . --key=signing-key.pem
   npx @planuze/pack-publisher pack publish ./*.plnzpack --token="$PLANUZE_PUBLISH_TOKEN" --ci-mode
   ```

O que o `pack build` faz: roda `lintPack()` primeiro, assina `manifest.json` +
`pack.lock` com Ed25519, cifra os blobs com XChaCha20-Poly1305, busca a pubkey de
escrow do registry (você não configura escrow) e grava o `.plnzpack`. O
`publicKeyFingerprint` zero do boilerplate é sobrescrito com a fingerprint real da
sua chave.

> [!CAUTION]
> Nunca commite `*.pem` nem cole o token em código. O workflow escreve a chave em
> arquivo efêmero e a apaga em `always()`.

---

## 10. Moderação, verified e entitlement

- **Assinatura ≠ confiança total.** A assinatura garante o **conteúdo** (não foi
  adulterado). A **visibilidade** e a **moderação** são controle de servidor
  (metadata mutável) — o valor de `distribution.visibility` no manifest é só o
  inicial.
- **Chain-of-trust / verified.** Ao registrar sua chave, ela entra em verificação
  do staff (chain publisher ← root). Packs de publisher verificado ganham selo; a
  primeira publicação de um publisher novo pode aguardar verificação.
- **Entitlement.** Para `extension`/`module-pack`, `requiresParentEntitlement`
  (default `true`) exige que o usuário tenha direito ao template parent. Packs pagos
  usam `license: "paid"` + `tier`/`priceUsd`/`requiredCapabilities` — o gate de
  acesso é **capability**, não o número do tier.
- **Categoria/tags** passam pela taxonomia do registry no publish (slugs
  desconhecidos são descartados).

---

## 11. Referência de comandos da CLI

`@planuze/pack-publisher` expõe o binário `planuze`:

```bash
planuze pack init <pack-id> [--kind template|extension] [--extends <parent>] [--modules a,b]
planuze pack lint [pack-dir]
planuze pack run <pack-dir> [project-dir] [--steps=a,b] [--models=a,b] [--debug]
planuze pack build [pack-dir] --key=<pem> [--escrow-public-key=<base64>]
planuze pack inspect <pack.plnzpack> [--json] [--with-files] [--public-key=<pem>]
planuze pack publish <pack.plnzpack> [--token=<token>] [--endpoint=<url>] [--ci-mode]
planuze pack publisher:keygen [--output=<dir>]
planuze pack publisher:register-key [--key=<pem>]
```

Os scripts em `package.json` embrulham os mais usados: `npm run lint`,
`npm test`, `npm run check:docs`, `npm run run:demo`, `npm run keygen`,
`npm run build`, `npm run inspect`, `npm run sign:publish`, `npm run scaffold`.
