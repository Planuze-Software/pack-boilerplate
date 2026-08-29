import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CANONICAL_BOILERPLATE_REPOSITORY,
  findReleasePlaceholders,
  mayKeepExampleIdentity,
} from '../scripts/check-release-readiness.mjs';

const exampleManifest = {
  id: 'acme/hello-service',
  name: '@acme/pack-hello-service',
  author: {
    name: 'Acme',
    email: 'packs@acme.example',
    url: 'https://acme.example',
  },
};

test('example publisher identity is rejected for release', () => {
  const issues = findReleasePlaceholders(exampleManifest, { name: '@acme/pack-boilerplate' });
  assert.equal(issues.length, 6);
});

test('custom publisher identity passes the release gate', () => {
  const issues = findReleasePlaceholders(
    {
      id: 'company/notifications',
      name: '@company/pack-notifications',
      author: {
        name: 'Company',
        email: 'packs@company.test',
        url: 'https://company.test',
      },
    },
    { name: '@company/pack-notifications' },
  );
  assert.deepEqual(issues, []);
});

test('only the canonical GitHub boilerplate repository may retain examples', () => {
  assert.equal(
    mayKeepExampleIdentity({
      GITHUB_ACTIONS: 'true',
      GITHUB_REPOSITORY: CANONICAL_BOILERPLATE_REPOSITORY,
    }),
    true,
  );
  assert.equal(
    mayKeepExampleIdentity({
      GITHUB_ACTIONS: 'true',
      GITHUB_REPOSITORY: 'someone/pack-boilerplate',
    }),
    false,
  );
  assert.equal(mayKeepExampleIdentity({}), false);
});
