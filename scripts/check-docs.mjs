#!/usr/bin/env node
/* Docs gate — espelha `check-pack-docs` / `lintPackDocs` do pack-format (ADR-0303
 * + ADR-0723). Standalone (zero-dep) para rodar no CI deste repo boilerplate sem
 * o monorepo do Planuze.
 *
 * Garante que TODA doc declarada no manifest (`manifest.doc` + `modules[].doc`)
 * existe em `docs/<locale>/<doc>` para cada locale suportado (derivado de
 * `locales/*.json`) MAIS o fallback `en-US`, e que não é um stub (piso de
 * MIN_DOC_CONTENT_LINES linhas de conteúdo). Sai com código 1 se houver falha.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FALLBACK_DOC_LOCALE = 'en-US';
const MIN_DOC_CONTENT_LINES = 10;

const packDir = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(readFileSync(join(packDir, 'manifest.json'), 'utf8'));

const declaredDocs = [];
if (typeof manifest.doc === 'string') declaredDocs.push(manifest.doc);
for (const module of manifest.modules ?? []) {
  if (typeof module.doc === 'string') declaredDocs.push(module.doc);
}

if (declaredDocs.length === 0) {
  console.log('check:docs — nenhuma doc declarada; nada a validar.');
  process.exit(0);
}

const localesDir = join(packDir, 'locales');
const supportedLocales = existsSync(localesDir)
  ? readdirSync(localesDir)
      .filter((name) => name.endsWith('.json'))
      .map((name) => name.slice(0, -'.json'.length))
  : [];
const requiredLocales = [...new Set([...supportedLocales, FALLBACK_DOC_LOCALE])].sort();

const countContentLines = (text) =>
  text.split(/\r?\n/).filter((line) => line.trim().length > 0).length;

const errors = [];
for (const doc of declaredDocs) {
  for (const locale of requiredLocales) {
    const relative = `docs/${locale}/${doc}`;
    const resolved = join(packDir, 'docs', locale, doc);
    if (!existsSync(resolved)) {
      errors.push(`FALTA: ${relative}`);
      continue;
    }
    const lines = countContentLines(readFileSync(resolved, 'utf8'));
    if (lines < MIN_DOC_CONTENT_LINES) {
      errors.push(`STUB: ${relative} (${lines} linhas < ${MIN_DOC_CONTENT_LINES})`);
    }
  }
}

if (errors.length > 0) {
  console.error('check:docs — FALHOU:');
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(
  `check:docs — OK (${declaredDocs.length} doc(s) × ${requiredLocales.length} locale(s): ${requiredLocales.join(', ')}).`,
);
