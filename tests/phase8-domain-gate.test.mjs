import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const file = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('Phase 8 is manual, staging-only and requires environment approval', () => {
  const wf = file('.github/workflows/staging-domain-gate.yml');
  const code = file('scripts/staging-domain-gate.mjs');
  assert.match(wf, /workflow_dispatch:/);
  assert.doesNotMatch(wf, /^  push:/m);
  assert.match(wf, /community-internal-release/);
  assert.match(wf, /COMMUNITY_RELEASE_UNLOCK/);
  assert.match(wf, /refs\/heads\/main/);
  for (const action of ['check', 'enable-protected-domain', 'disable-domain']) assert.ok(wf.includes(action));
  assert.match(wf, /group: community-staging-ingress/);
  assert.match(code, /staging-community\.nowen\.cn/);
  assert.match(code, /nowen-community-staging-assets/);
  assert.match(code, /073ece5c-4518-4d3c-a264-d9f976020554/);
});
test('Staging domain gate locks Access, Turnstile, and forbids public previews', () => {
  const code = file('scripts/staging-domain-gate.mjs');
  for (const value of [
    'NOWEN Community Staging Access', "app.destinations", "policy", "previews_enabled",
    "'secret_text'", "Turnstile must be restricted to staging hostname",
    'Access must cover ONLY the staging Worker', 'Require one exact-email Include',
    'assertAnonymousDenied()', '/api/health', 'FAIL OPEN', 'FAIL CLOSED'
  ]) assert.ok(code.includes(value), 'missing guard: ' + value);
  assert.match(code, /bindings.get\('ASSETS'\)\?\.type/);
  assert.match(code, /async function detachExactDomain/);
  assert.match(code, /let deletionError=null/);
  assert.match(code, /if \(!target\(await getDomains\(\)\)\)/);
  assert.match(code, /if \(ACTION === 'disable'\)/);
  assert.match(code, /else if \(ACTION === 'check'\)/);
  assert.doesNotMatch(code, /\/dns_records.*'POST'|\/dns_records.*'DELETE'|d1\/database.*'POST'/);
  assert.match(code, /existing\.service, WORKER/);
  assert.match(code, /existing\.zone_id, ZONE/);
  assert.match(code, /attachAttempted = true/);
});
test('Phase 7 and Phase 8 share ingress concurrency lock', () => {
  const a = file('.github/workflows/protected-test-entry.yml');
  const b = file('.github/workflows/staging-domain-gate.yml');
  assert.match(a, /group: community-staging-ingress/);
  assert.match(b, /group: community-staging-ingress/);
});
