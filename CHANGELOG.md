# Changelog

All notable changes to this pack are documented here. This project adheres to
[Semantic Versioning](https://semver.org) and
[Keep a Changelog](https://keepachangelog.com).

The `version` in `manifest.json` is the source of truth for the pack version. A
git tag `v<version>` triggers publication only after the repository installs the
SHA-pinned reusable workflow shown by the Planuze Publisher Portal.

## [Unreleased]

### Changed

- Align the example manifest with app `0.0.13`, declare `fs.write`, and bundle the
  integration agent explicitly.
- Keep source templates parseable before placeholder rendering so fail-closed
  scanning can inspect them.
- Replace direct tag publishing with a secretless, SHA-pinned validation workflow.
- Exercise a real bundle in validation with ephemeral signing and escrow keys.
- Pin the public authoring CLI and dependency graph; remove `@latest` automation.
- Ignore the `.key` filenames emitted by the current key generator and point the
  registration helper at the generated private key.
- Provide canonical API and registry fallbacks around the currently published CLI.
- Document the direct GitHub attestation and provider-neutral central scan used by
  GitLab and Bitbucket releases.
- Update the authoring CLI to `0.4.0` and replace the obsolete H1 placeholder with
  the activated immutable release workflow SHA.
- Keep `0.4.0` as the local authoring dependency until `0.4.1` is published and the
  central runtime reports ready; only then expose the LIVE GitLab/Bitbucket snippets.
- Store the Bitbucket signing key as protected Base64, decode it into a temporary
  file, and validate the PEM before invoking the release command.

### Added

- Release-readiness gate that rejects the example `acme` identity outside the
  canonical boilerplate repository.

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
