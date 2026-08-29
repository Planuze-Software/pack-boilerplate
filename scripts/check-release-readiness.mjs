#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CANONICAL_BOILERPLATE_REPOSITORY = 'Planuze-Software/pack-boilerplate';

const packDir = dirname(dirname(fileURLToPath(import.meta.url)));

function isExampleUrl(value) {
  return typeof value === 'string' && /(?:^|\.)example(?:\/|$)/i.test(value);
}

export function findReleasePlaceholders(manifest, packageJson) {
  const issues = [];

  if (manifest.id === 'acme/hello-service' || manifest.id?.startsWith('acme/')) {
    issues.push('manifest.id ainda usa o namespace de exemplo `acme`');
  }
  if (manifest.name?.startsWith('@acme/')) {
    issues.push('manifest.name ainda usa o namespace de exemplo `@acme`');
  }
  if (packageJson.name?.startsWith('@acme/')) {
    issues.push('package.json:name ainda usa o namespace de exemplo `@acme`');
  }
  if (manifest.author?.name === 'Acme') {
    issues.push('manifest.author.name ainda é `Acme`');
  }
  if (isExampleUrl(manifest.author?.url)) {
    issues.push('manifest.author.url ainda usa um domínio `.example`');
  }
  if (typeof manifest.author?.email === 'string' && manifest.author.email.endsWith('.example')) {
    issues.push('manifest.author.email ainda usa um domínio `.example`');
  }

  return issues;
}

export function mayKeepExampleIdentity(env = process.env) {
  return (
    env.GITHUB_ACTIONS === 'true' &&
    env.GITHUB_REPOSITORY === CANONICAL_BOILERPLATE_REPOSITORY
  );
}

export async function checkReleaseReadiness({
  manifestPath = join(packDir, 'manifest.json'),
  packagePath = join(packDir, 'package.json'),
  env = process.env,
} = {}) {
  const [manifestText, packageText] = await Promise.all([
    readFile(manifestPath, 'utf8'),
    readFile(packagePath, 'utf8'),
  ]);
  const issues = findReleasePlaceholders(JSON.parse(manifestText), JSON.parse(packageText));

  if (issues.length === 0) return { allowed: true, issues };
  return { allowed: mayKeepExampleIdentity(env), issues };
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  const result = await checkReleaseReadiness();
  if (result.allowed) {
    if (result.issues.length > 0) {
      console.log('check:release-ready — identidade de exemplo permitida somente no repositório boilerplate canônico.');
    } else {
      console.log('check:release-ready — OK.');
    }
  } else {
    console.error('check:release-ready — substitua todos os placeholders antes de publicar:');
    for (const issue of result.issues) console.error(`  - ${issue}`);
    process.exitCode = 1;
  }
}
