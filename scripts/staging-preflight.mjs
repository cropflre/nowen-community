#!/usr/bin/env node
/**
 * Read-only Phase 5 staging release gate. Safe to run before/after first deployment.
 * Never applies D1 migrations, creates routes/domains, or mutates production resources.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
assert.ok(account && token, 'Cloudflare account and API token required');

const s = config.env?.staging;
assert.equal(config.name, 'nowen-community');
assert.equal(config.workers_dev, false);
assert.equal(config.preview_urls, false);
assert.equal(s?.name, 'nowen-community-staging');
assert.equal(s.workers_dev, false);
assert.equal(s.preview_urls, false);
assert.ok(!s.routes && !s.route && !s.custom_domain && !s.triggers, 'Staging must stay unrouted');
assert.equal(s.d1_databases?.length, 1);
assert.equal(s.d1_databases[0].binding, 'DB');
assert.equal(s.d1_databases[0].database_name, 'nowen-community-staging-db');
assert.equal(s.r2_buckets?.length, 1);
assert.equal(s.r2_buckets[0].binding, 'MEDIA');
assert.equal(s.r2_buckets[0].bucket_name, 'nowen-community-staging-assets');
assert.notEqual(s.d1_databases[0].database_id, config.d1_databases[0].database_id);
assert.notEqual(s.r2_buckets[0].bucket_name, config.r2_buckets[0].bucket_name);
assert.match(s.vars?.TURNSTILE_SITE_KEY ?? '', /^0x4[A-Za-z0-9_-]+$/);
assert.notEqual(s.vars.TURNSTILE_SITE_KEY, config.vars.TURNSTILE_SITE_KEY);
assert.equal(s.vars?.TURNSTILE_SECRET_KEY, undefined);
assert.equal(s.vars?.LOCAL_TEST_TURNSTILE, undefined);

const base = 'https://api.cloudflare.com/client/v4';
async function cf(path, method='GET', body) {
  const res = await fetch(base + path, {
    method,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(12000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) {
    const codes = data?.errors?.map(e => e.code).join(',') ?? 'unknown';
    throw new Error('Cloudflare staging preflight blocked (' + res.status + ', ' + codes + '): ' + path);
  }
  return data.result;
}
const dbId = s.d1_databases[0].database_id;
const root = '/accounts/' + account;
const [database, bucket, r2Dev, r2Domains, tablesResult, migrationsResult, workerRoutes, workerDomains] = await Promise.all([
  cf(root+'/d1/database/'+dbId),
  cf(root+'/r2/buckets/'+s.r2_buckets[0].bucket_name),
  cf(root+'/r2/buckets/'+s.r2_buckets[0].bucket_name+'/domains/managed'),
  cf(root+'/r2/buckets/'+s.r2_buckets[0].bucket_name+'/domains/custom'),
  cf(root+'/d1/database/'+dbId+'/query', 'POST', {
    sql: "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users','topics','replies','invitations','sessions','audit_logs','notifications','request_limits','d1_migrations')"
  }),
  cf(root+'/d1/database/'+dbId+'/query', 'POST', { sql:'SELECT name FROM d1_migrations ORDER BY id' }),
  cf('/zones/90b0a9e005f9cefa4c19dcb2c281dcc3/workers/routes'),
  cf(root+'/workers/domains'),
]);
assert.equal(database.name, 'nowen-community-staging-db');
assert.equal(bucket.name, 'nowen-community-staging-assets');
assert.equal(r2Dev.enabled, false, 'Staging R2 public development URL must be disabled');
assert.equal(r2Domains.domains?.length ?? 0, 0, 'Staging R2 custom domains must be absent');
const tables = new Set(tablesResult?.[0]?.results?.map(x=>x.name));
for (const name of ['users','topics','replies','invitations','sessions','audit_logs','notifications','request_limits','d1_migrations']) {
  assert.ok(tables.has(name), 'Missing staging D1 table ' + name);
}
const applied = migrationsResult?.[0]?.results?.map(x=>x.name);
assert.deepEqual(applied, ['0001_init.sql','0002_members.sql','0003_notifications.sql']);
assert.ok(!workerRoutes.some(r=>r.script==='nowen-community-staging'), 'Staging Worker route exists');
assert.ok(!workerDomains.some(d=>d.service==='nowen-community-staging' || d.hostname==='staging-community.nowen.cn'), 'Staging Worker custom domain exists');

if (process.env.STAGING_DEPLOYED === '1') {
  const [subdomain, settings] = await Promise.all([
    cf(root+'/workers/scripts/nowen-community-staging/subdomain'),
    cf(root+'/workers/scripts/nowen-community-staging/settings'),
  ]);
  assert.equal(subdomain.enabled, false, 'Staging workers.dev must be disabled');
  const bindings = new Map((settings.bindings || []).map(b=>[b.name,b]));
  assert.equal(bindings.get('DB')?.id, dbId);
  assert.equal(bindings.get('MEDIA')?.bucket_name, bucket.name);
  assert.equal(bindings.get('TURNSTILE_SITE_KEY')?.type, 'plain_text');
  assert.equal(bindings.get('TURNSTILE_SITE_KEY')?.text, s.vars.TURNSTILE_SITE_KEY);
  assert.equal(bindings.get('TURNSTILE_SECRET_KEY')?.type, 'secret_text');
  assert.equal(bindings.get('PASSWORD_PEPPER')?.type, 'secret_text');
}
console.log('Staging preflight PASS: isolated D1, R2 private, migrations tracked, no public routes/domains' + (process.env.STAGING_DEPLOYED==='1' ? ', Worker bindings validated.' : '.'));
