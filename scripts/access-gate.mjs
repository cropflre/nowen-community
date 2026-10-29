#!/usr/bin/env node
/**
 * NOWEN Community Phase 6 - read-only, fail-closed Access readiness gate.
 * Requires Cloudflare Access to be activated and an exact-email, Worker-scoped
 * Access policy to exist before anyone may attach a staging public hostname.
 * Does NOT bind DNS, change a Worker, modify Access policies or deploy.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
const staging = config.env?.staging;
assert.equal(staging?.name, 'nowen-community-staging');
assert.equal(staging?.workers_dev, false);
assert.equal(staging?.preview_urls, false);
assert.equal(staging?.d1_databases?.[0]?.database_name, 'nowen-community-staging-db');
assert.equal(staging?.r2_buckets?.[0]?.bucket_name, 'nowen-community-staging-assets');

const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
assert.ok(account && token, 'Missing Cloudflare account ID or API token.');
const base = 'https://api.cloudflare.com/client/v4';

async function cf(path) {
  const response = await fetch(base + path, {
    headers: { Authorization: 'Bearer ' + token },
    signal: AbortSignal.timeout(12000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.success !== true) {
    const code = data?.errors?.map(e => e.code).join(',') || 'unknown';
    const msg = data?.errors?.map(e => e.message).join(' ') || '';
    const hint = /access.api.error.not_enabled/i.test(msg)
      ? ' Cloudflare Zero Trust is not activated. Enable the Zero Trust Free plan in the Cloudflare dashboard first.'
      : response.status === 403
      ? ' Check API Token permission: Cloudflare Access Apps and Policies (Read).'
      : '';
    throw new Error('Access safety gate blocked (' + response.status + ', ' + code + ').' + hint);
  }
  return data.result;
}

const root = '/accounts/' + account;
const workers = await cf(root + '/workers/scripts');
const worker = workers.find(x => x.id === 'nowen-community-staging');
assert.ok(worker?.tag, 'Staging Worker not deployed or missing stable Cloudflare Worker ID.');
// Pin the exact Access app. Some least-privilege GitHub tokens see an empty
// /access/apps list rather than a 403; never misdiagnose that as a missing app.
const ACCESS_APP_ID = 'd3894200-0bfe-4a51-aa41-aa98e93e2d98';
let app;
try {
  app = await cf(root + '/access/apps/' + ACCESS_APP_ID);
} catch (error) {
  throw new Error('Cannot read pinned staging Access app via GitHub Cloudflare token. Check Account → Access: Apps and Policies → Read scope, and account resource restriction. ' + String(error));
}
assert.equal(app?.id, ACCESS_APP_ID, 'Unexpected Access app ID (possible wrong account).');
assert.equal(app.name, 'NOWEN Community Staging Access', 'Wrong Access application.');
assert.equal(app.type, 'self_hosted', 'Use a self-hosted Access application.');
assert.ok(
  (app.destinations || []).some(d => d.type === 'worker' && d.worker_id === worker.tag),
  'Access application MUST protect the staging Worker itself with All traffic, not just previews or one hostname.'
);
assert.notEqual(app.bypass, true, 'Access application bypass mode is forbidden.');

const policies = await cf(root + '/access/apps/' + app.id + '/policies');
assert.ok(Array.isArray(policies), 'Cloudflare did not return Access policy list.');
assert.ok(policies.length > 0, 'No Access policies found. Deny-by-default is safe but not ready for browser tests.');
let approvedEmailRuleCount = 0;
for (const policy of policies) {
  assert.notEqual(policy.decision, 'bypass', 'Bypass policies are forbidden for staging.');
  if (policy.decision !== 'allow') continue;
  const includes = policy.include || [];
  assert.ok(includes.length > 0, 'An allow policy must have explicit includes.');
  for (const rule of includes) {
    const email = rule?.email?.email;
    assert.ok(typeof email === 'string' && email === email.trim() && email.includes('@') && email.split('@').length === 2 && email.split('@')[1].includes('.') && !Array.from(email).some(ch => ch.charCodeAt(0) <= 32),
      'All allow-policy includes must target a specific email; Everyone or email-domain rules are prohibited.');
    approvedEmailRuleCount++;
  }
}
assert.ok(approvedEmailRuleCount > 0, 'No exact-email Allow policy found.');
console.log('ACCESS SAFETY GATE PASS: isolated staging Worker, All traffic protection, exact-email Allow policy; no Bypass.');
console.log('This is a configuration review only. Browser verification of anonymous rejection is still required before binding staging-community.nowen.cn.');
