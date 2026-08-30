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
- Pin the authoring and provider-neutral release CLI to `0.4.1` and replace the
  obsolete H1 placeholder with the activated immutable release workflow SHA.
- Keep GitLab/Bitbucket snippets fail-closed behind the Portal central-runtime
  readiness signal; no provider falls back to an unattested release.
- Store the Bitbucket signing key as Base64 in a secured variable, decode it into
  a temporary file, and validate the PEM before invoking the release command.
- Require the GitLab `v*` protected-tag rule before protected release variables
  can reach a tag pipeline.
- Use Bitbucket's current secured-variable terminology and require the padlock for
  both release credentials.
- Fail closed unless the GitLab or Bitbucket tag commit belongs to the provider's
  validated default branch, including safe completion of shallow clones.
- Pin the GitHub caller example to the final immutable H1 revision that enforces
  default-branch ancestry and exact `v<manifest.version>` matching.
- Make the canonical production registry fallback explicit for every provider so
  pack repositories do not need to define `PLANUZE_REGISTRY_URL`.

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
