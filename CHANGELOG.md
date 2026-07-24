# Changelog

All notable changes to this pack are documented here. This project adheres to
[Semantic Versioning](https://semver.org) and
[Keep a Changelog](https://keepachangelog.com).

The `version` in `manifest.json` is the source of truth for the pack version; a
git tag `v<version>` triggers the publish workflow (`.github/workflows/ci.yml`).

## [Unreleased]

## [0.1.0] - 2026-07-23

### Added

- Initial pack boilerplate: `manifest.json` (module-pack example `acme/hello-service`).
- Generator (`generator/index.js`) with `emit-event` / `handlebars-render` /
  `path-safety` helpers and `init` / `render` / `write` steps.
- `greeter` module templates under `base/greeter/`.
- Integration agent (`agent/agents.json` + rules + description) that wires
  `greet()` and avoids dead code.
- Rich per-locale docs (`docs/{pt-BR,en-US}/{overview,greeter}.md`).
- i18n catalogs (`locales/{pt-BR,en-US}.json`).
- Authoring guide (`README.md`), manifest reference (`MANIFEST.md`), plop scaffolder
  (`plopfile.js`), and CI/CD workflow (`.github/workflows/ci.yml`).
