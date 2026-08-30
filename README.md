# Planuze Pack Boilerplate

Ponto de partida **cloável** para construir um pack do Planuze. Clone, renomeie,
implemente, teste e publique — sem começar de uma folha em branco.

Este repositório **é** um pack funcional de exemplo (`acme/hello-service`, um
`module-pack` que gera um serviço de saudação para projetos NEP). Cada peça é
mínima, real e coerente com os gates da plataforma (schema do manifest, gate de
docs por-locale, gate de locales, contrato NDJSON do generator, assinatura
Ed25519 no release atestado).

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
| `extension` | `src/modules/<id>/` (módulo novo) | não | **obrigatório** | `observability` |
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
├── package.json               # ferramentas locais fixadas + scripts de validação
├── package-lock.json          # grafo exato usado pela CI de validação
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
│   ├── check-bundle.mjs        # build efêmero real, sem usar secrets
│   ├── check-docs.mjs          # gate de docs standalone (espelha check-pack-docs)
│   ├── check-source-manifest.mjs # exige o placeholder de assinatura no source
│   └── check-release-readiness.mjs # bloqueia identidade `acme` fora deste boilerplate
├── test/
│   └── generator-smoke.test.mjs# smoke: roda o generator num dir temporário
├── plopfile.js                 # scaffolder de novo módulo
├── plop-templates/module/       # templates do scaffolder
└── .github/workflows/ci.yml    # validação sem secrets; não publica
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

Ou, com a CLI do Planuze: `npx @planuze/pack-publisher pack run . /tmp/proj --debug`.

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
   call-site e, se for **código morto**, **conectar a chamada** (via `edit_file`),
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
#   - NÃO altere publicKeyFingerprint nem adicione publisherFingerprint no source
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
npm run check:source-manifest    # exige sha256: + 64 zeros no manifest-fonte
npm run lint                     # lint completo (manifest+locales+generator+docs)
npm run check:bundle             # monta um .plnzpack efêmero com chaves descartáveis
npm run run:demo                 # (opcional) roda o generator sobre ./tmp/demo
npm run check:release-ready      # precisa passar depois de trocar a identidade de exemplo

# 5. PREPARE O RELEASE (ver seção 9)
# copie o caller exibido no Portal do Publisher, sempre fixado no SHA H1
```

Regra de ouro ao renomear: **as `labelKey` do manifest e as chaves dos
`locales/*.json` têm que casar** — rode `npm run lint` para confirmar.

O campo `publicKeyFingerprint` é uma exceção deliberada à renomeação: o
manifest-fonte deve manter **exatamente**
`sha256:0000000000000000000000000000000000000000000000000000000000000000`.
Não cole nele a fingerprint real criada pelo `keygen` e não adicione
`publisherFingerprint` ao source.

---

## 9. Publicação (CI/CD-first)

A publicação LIVE é **CI/CD-first e atestada**. No GitHub, o workflow reutilizável
coleta um único snapshot, escaneia, assina, cifra e atesta o checksum com OIDC. No
GitLab e Bitbucket, a CLI constrói o artifact e o scan central Planuze verifica os
bytes cifrados recebidos antes do finalize. Não rode `pack publish` da sua máquina e
não copie a chave privada para o checkout.

O manifest-fonte contém somente o placeholder de 64 zeros. Durante a publicação,
o build atestado deriva a chave pública da signing key mantida fora do checkout e
injeta `publicKeyFingerprint` e `publisherFingerprint` reais apenas no `.plnzpack`.
O registry resolve a chave pública registrada por essa fingerprint e valida a
cadeia, a revogação e a assinatura antes de aceitar o artefato. Por isso uma
fingerprint real nunca deve ser fixada no repositório do pack.

### O que este repositório faz hoje

`.github/workflows/ci.yml` executa somente validação em push/PR: instalação pelo
`package-lock.json`, lint, docs, smoke test e um bundle real com chaves efêmeras. O
job tem apenas `contents: read`, não recebe secrets e não publica por tag. A CLI
pública usada para authoring está fixada
em `@planuze/pack-publisher@0.4.1`; nunca use `@latest` em automação. A CLI e o
wrapper local usam os endpoints canônicos da API e do registry por padrão, sem
exigir configuração do desenvolvedor.

O caller LIVE **não faz parte do clone automático**, porque este repositório ainda
usa a identidade de exemplo `acme`. Depois de substituir os placeholders, copie do
Portal o caller fixado no SHA de ativação H1
`4f154d2ddd9c5e0b19bc5637a45db001da7a2cc2`.

### GitHub Actions (publicação LIVE)

1. Gere uma chave Ed25519 (`npm run keygen`) e registre a pública
   (`npm run register-key`) pelo Portal/CLI. A privada é criada como
   `.local-keys/publisher.key` e nunca entra no Git; `.gitignore` cobre os
   formatos de chave usados pela CLI. Não copie a fingerprint exibida para o
   manifest-fonte: ele permanece com o placeholder de 64 zeros.
2. Em **Settings → Secrets and variables → Actions → Secrets**, crie somente:
   - `PLANUZE_SIGNING_KEY` — PEM privada correspondente à chave registrada;
   - `PLANUZE_PUBLISH_TOKEN` — token dedicado ao repositório, escopo `publish`.
3. Copie do Portal o `.github/workflows/publish.yml` fixado por SHA. O formato será:

   ```yaml
   name: Release pack

   on:
     push:
       tags: ['v*']

   jobs:
     release:
       permissions:
         contents: read
         id-token: write
       uses: Planuze-Software/cms/.github/workflows/pack-release.yml@4f154d2ddd9c5e0b19bc5637a45db001da7a2cc2
       with:
         pack_dir: .
       secrets:
         PLANUZE_PUBLISH_TOKEN: ${{ secrets.PLANUZE_PUBLISH_TOKEN }}
         PLANUZE_SIGNING_KEY: ${{ secrets.PLANUZE_SIGNING_KEY }}
   ```

4. Confirme que o SHA continua igual ao exibido no Portal, rode
   `npm run check:release-ready`, atualize o SemVer do manifest e envie a tag
   `v<manifest.version>`.

`PLANUZE_REGISTRY_URL` não precisa ser criada em nenhum provider: a CLI usa o
fallback de produção `https://registry.planuze.com/v1`. Só defina essa variável
quando a Planuze fornecer explicitamente outro registry. `SCAN_RUNNER_URL` também
não pertence ao repositório do pack; a Planuze seleciona internamente o runner
atestado correspondente ao provider.

> [!CAUTION]
> Nunca use `@main`, tags móveis ou um SHA inventado no caller. Nunca configure
> root key, escrow key, segredo interno, token Cloudflare ou `SCAN_RUNNER_URL` no
> repositório do pack.

### GitLab e Bitbucket

Os dois providers publicam pelo scan central, sem mirror e sem token GitHub. Os
snippets LIVE abaixo usam a CLI pública fixada em `0.4.1`, mas só devem ser
instalados quando o Portal indicar `Scan central atestado`. Se o Portal mostrar
`Ativação em andamento`, aguarde: não há fallback inseguro. No GitLab,
`PLANUZE_SIGNING_KEY` é uma variable protegida do tipo **File** e
`PLANUZE_PUBLISH_TOKEN` é mascarada/protegida. Antes da primeira publicação, abra
**Settings → Repository → Protected tags**, crie o wildcard `v*` e permita a criação
somente aos papéis que podem publicar. Sem a tag protegida, o GitLab não entrega
essas variables protegidas ao job:

```yaml
# .gitlab-ci.yml
release_pack:
  image: node:24
  rules:
    - if: $CI_COMMIT_TAG
  before_script:
    - npm install --global --ignore-scripts @planuze/pack-publisher@0.4.1
  script:
    - |
      set -eu
      test -n "${CI_DEFAULT_BRANCH:-}" || {
        printf 'CI_DEFAULT_BRANCH is required\n' >&2
        exit 1
      }
      git check-ref-format --branch "$CI_DEFAULT_BRANCH" >/dev/null
      default_ref="refs/remotes/origin/$CI_DEFAULT_BRANCH"
      fetch_ref="+refs/heads/$CI_DEFAULT_BRANCH:$default_ref"
      if test "$(git rev-parse --is-shallow-repository)" = true; then
        git fetch --no-tags --prune --unshallow origin "$fetch_ref"
      else
        git fetch --no-tags --prune origin "$fetch_ref"
      fi
      test "$(git rev-parse HEAD)" = "$CI_COMMIT_SHA" || {
        printf 'Checkout does not match CI_COMMIT_SHA\n' >&2
        exit 1
      }
      git rev-parse --verify "$default_ref^{commit}" >/dev/null
      git merge-base --is-ancestor "$CI_COMMIT_SHA" "$default_ref" || {
        printf 'Release tag commit must belong to %s\n' "$CI_DEFAULT_BRANCH" >&2
        exit 1
      }
      expected_tag="v$(node -p "require('./manifest.json').version")"
      test "$CI_COMMIT_TAG" = "$expected_tag" || {
        printf 'Tag %s does not match %s\n' "$CI_COMMIT_TAG" "$expected_tag" >&2
        exit 1
      }
      release_root="$(mktemp -d)"
      trap 'rm -rf -- "$release_root"' EXIT HUP INT TERM
      chmod 700 "$release_root"
      key_path="$release_root/publisher-signing-key.pem"
      umask 077
      cp "$PLANUZE_SIGNING_KEY" "$key_path"
      chmod 600 "$key_path"
      PLANUZE_PUBLISHER_TOKEN="$PLANUZE_PUBLISH_TOKEN" planuze pack release . \
        --key="$key_path" --out="$release_root/release.plnzpack" --ci-mode
```

No Bitbucket, abra **Repository settings → Pipelines → Repository variables** e
configure duas **secured variables**, selecionando o cadeado em ambas:
`PLANUZE_SIGNING_KEY_B64` contém o Base64 de uma PEM privada e
`PLANUZE_PUBLISH_TOKEN` contém o token. O Bitbucket não preserva com segurança uma
PEM multiline em uma variável; não cadastre `PLANUZE_SIGNING_KEY` nesse provider.

```yaml
# bitbucket-pipelines.yml
pipelines:
  tags:
    'v*':
      - step:
          name: Release pack
          image: node:24
          script:
            - npm install --global --ignore-scripts @planuze/pack-publisher@0.4.1
            - |
              set -eu
              default_ref="$(
                git ls-remote --symref origin HEAD |
                  awk '$1 == "ref:" && $3 == "HEAD" { print $2 }'
              )"
              case "$default_ref" in
                refs/heads/*) ;;
                *)
                  printf 'Remote default branch ref is invalid\n' >&2
                  exit 1
                  ;;
              esac
              git check-ref-format "$default_ref"
              default_branch="${default_ref#refs/heads/}"
              remote_default_ref="refs/remotes/origin/$default_branch"
              fetch_ref="+$default_ref:$remote_default_ref"
              if test "$(git rev-parse --is-shallow-repository)" = true; then
                git fetch --no-tags --prune --unshallow origin "$fetch_ref"
              else
                git fetch --no-tags --prune origin "$fetch_ref"
              fi
              test "$(git rev-parse HEAD)" = "$BITBUCKET_COMMIT" || {
                printf 'Checkout does not match BITBUCKET_COMMIT\n' >&2
                exit 1
              }
              git rev-parse --verify "$remote_default_ref^{commit}" >/dev/null
              git merge-base --is-ancestor "$BITBUCKET_COMMIT" "$remote_default_ref" || {
                printf 'Release tag commit must belong to %s\n' "$default_branch" >&2
                exit 1
              }
              expected_tag="v$(node -p "require('./manifest.json').version")"
              test "$BITBUCKET_TAG" = "$expected_tag" || {
                printf 'Tag %s does not match %s\n' "$BITBUCKET_TAG" "$expected_tag" >&2
                exit 1
              }
              release_root="$(mktemp -d)"
              trap 'rm -rf -- "$release_root"' EXIT HUP INT TERM
              chmod 700 "$release_root"
              key_path="$release_root/publisher-signing-key.pem"
              umask 077
              test -n "${PLANUZE_SIGNING_KEY_B64:-}" || {
                printf 'PLANUZE_SIGNING_KEY_B64 is required\n' >&2
                exit 1
              }
              printf '%s' "$PLANUZE_SIGNING_KEY_B64" | base64 --decode > "$key_path"
              test -s "$key_path"
              chmod 600 "$key_path"
              node -e "require('node:crypto').createPrivateKey(require('node:fs').readFileSync(process.argv[1]))" "$key_path"
              PLANUZE_PUBLISHER_TOKEN="$PLANUZE_PUBLISH_TOKEN" planuze pack release . \
                --key="$key_path" --out="$release_root/release.plnzpack" --ci-mode
```

Não configure `SCAN_RUNNER_URL`, OIDC manual, escrow, `INTERNAL_SHARED_SECRET` ou
credenciais GitHub. `PLANUZE_REGISTRY_URL` continua opcional com o fallback
canônico descrito acima. A CLI seleciona o scan central e só conclui quando o
registry recebe o atestado do checksum.

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

`@planuze/pack-publisher` expõe o binário `planuze`. Os comandos de authoring são:

```bash
planuze pack init <pack-id> [--kind template|extension] [--extends <parent>] [--modules a,b]
planuze pack lint [pack-dir]
planuze pack run <pack-dir> [project-dir] [--steps=a,b] [--models=a,b] [--debug]
planuze pack build [pack-dir] --key=<pem> [--escrow-public-key=<base64>]
planuze pack release [pack-dir] --key=<pem> [--token=<token>] [--endpoint=<url>] [--ci-mode]
planuze pack inspect <pack.plnzpack> [--json] [--with-files] [--public-key=<pem>]
planuze pack publish <pack.plnzpack> [--token=<token>] [--endpoint=<url>] [--ci-mode]
planuze pack publisher:keygen [--output=<dir>]
planuze pack publisher:register-key [--key=<pem>]
```

Os scripts em `package.json` embrulham os mais usados: `npm run lint`,
`npm test`, `npm run check:docs`, `npm run check:source-manifest`,
`npm run check:bundle`, `npm run run:demo`, `npm run keygen`,
`npm run build:local`, `npm run inspect`, `npm run scaffold` e
`npm run check:release-ready`. `build:local` serve apenas para inspecionar um
artefato durante desenvolvimento; a publicação LIVE é responsabilidade exclusiva
do pipeline atestado exibido no Portal.
