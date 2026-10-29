#!/usr/bin/env node
/**
 * Phase 8 - Access-protected staging custom domain.
 * check  : read-only readiness inspection; requires no existing domain
 * enable : attach one staging custom domain, prove anonymous Access denial;
 *          automatically detach on any error
 * disable: emergency detach of that single domain, without Access API reads
 *
 * Never writes DNS records, deploys Workers or touches D1/R2 data.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ACTION = process.argv[2] || 'check';
assert.ok(['check', 'enable', 'disable'].includes(ACTION), 'Unknown phase8 action');
const cfg = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
const stage = cfg.env?.staging;
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT_ID = '7363e4151dcbcf430e342b6119b92925';
const ZONE = '90b0a9e005f9cefa4c19dcb2c281dcc3';
const ACCESS = 'd3894200-0bfe-4a51-aa41-aa98e93e2d98';
const WORKER = 'nowen-community-staging';
const HOST = 'staging-community.nowen.cn';
const PROD_HOST = 'community.nowen.cn';
const ROOT = '/accounts/' + ACCOUNT_ID;

assert.equal(ACCOUNT, ACCOUNT_ID, 'Unexpected Cloudflare account');
assert.ok(TOKEN, 'Missing Cloudflare API token');
assert.equal(cfg.name, 'nowen-community');
assert.equal(cfg.workers_dev, false);
assert.equal(cfg.preview_urls, false);
assert.equal(stage?.name, WORKER);
assert.equal(stage?.workers_dev, false);
assert.equal(stage?.preview_urls, false);
assert.equal(stage?.d1_databases?.[0]?.database_id, '073ece5c-4518-4d3c-a264-d9f976020554');
assert.equal(stage?.r2_buckets?.[0]?.bucket_name, 'nowen-community-staging-assets');
assert.equal(stage?.vars?.TURNSTILE_SITE_KEY, '0x4AAAAAAFqs6kkoGTOIXsrz');
assert.ok(!stage.route && !stage.routes && !stage.custom_domain, 'Staging config must remain unrouted');
assert.notEqual(stage.d1_databases[0].database_id, cfg.d1_databases?.[0]?.database_id);
assert.notEqual(stage.r2_buckets[0].bucket_name, cfg.r2_buckets?.[0]?.bucket_name);

async function cf(path, method = 'GET', body) {
  const response = await fetch('https://api.cloudflare.com/client/v4' + path, {
    method,
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.success !== true) {
    throw new Error('Cloudflare ' + method + ' ' + path + ' failed, HTTP ' +
      response.status + ', codes ' + (data?.errors?.map(e => e.code).join(',') || 'unknown'));
  }
  return data.result;
}
function target(domains) {
  assert.ok(Array.isArray(domains), 'Expected domain list');
  const selected = domains.filter(x => x.hostname === HOST);
  assert.ok(selected.length <= 1, 'Ambiguous duplicate staging custom domain');
  return selected[0] || null;
}
function ensureNoUnexpectedDomains(domains) {
  assert.ok(!domains.some(d => d.hostname === PROD_HOST && d.service === WORKER),
    'Staging Worker must never serve production hostname');
  assert.ok(!domains.some(d => d.service === WORKER && d.hostname !== HOST),
    'Unexpected staging custom domain');
}
async function getDomains() {
  return cf(ROOT + '/workers/domains');
}
async function getSubdomain() {
  const x = await cf(ROOT + '/workers/scripts/' + WORKER + '/subdomain');
  assert.equal(x.enabled, false, 'workers.dev must remain OFF');
  assert.equal(x.previews_enabled, false, 'Version previews must remain OFF');
}
async function verifyReadiness() {
  const [workers, settings, domains, routes, zone, dns, app, policies, widget] =
    await Promise.all([
      cf(ROOT + '/workers/scripts'),
      cf(ROOT + '/workers/scripts/' + WORKER + '/settings'),
      getDomains(),
      cf('/zones/' + ZONE + '/workers/routes'),
      cf('/zones/' + ZONE),
      cf('/zones/' + ZONE + '/dns_records?name=' + encodeURIComponent(HOST)),
      cf(ROOT + '/access/apps/' + ACCESS),
      cf(ROOT + '/access/apps/' + ACCESS + '/policies'),
      cf(ROOT + '/challenges/widgets/' + stage.vars.TURNSTILE_SITE_KEY),
    ]);
  assert.equal(zone.name, 'nowen.cn');
  assert.equal(zone.status, 'active');
  assert.equal(zone.account?.id, ACCOUNT_ID);
  const worker = workers.find(x => x.id === WORKER);
  assert.ok(worker?.tag, 'Staging Worker not deployed');
  const bindings = new Map((settings.bindings || []).map(x => [x.name, x]));
  assert.equal(bindings.get('ASSETS')?.type, 'assets', 'Missing ASSETS binding: do not open broken topic pages');
  assert.equal(bindings.get('DB')?.id, stage.d1_databases[0].database_id);
  assert.equal(bindings.get('MEDIA')?.bucket_name, stage.r2_buckets[0].bucket_name);
  assert.equal(bindings.get('TURNSTILE_SITE_KEY')?.text, stage.vars.TURNSTILE_SITE_KEY);
  assert.equal(bindings.get('TURNSTILE_SECRET_KEY')?.type, 'secret_text');
  assert.ok(!routes.some(x => x.script === WORKER), 'Unexpected staging Worker route');
  await getSubdomain();
  ensureNoUnexpectedDomains(domains);
  assert.equal(target(domains), null, 'Staging custom domain already attached; use disable first');
  assert.ok(Array.isArray(dns) && dns.length === 0,
    'Existing DNS record for staging hostname must be reviewed manually');
  assert.equal(app.id, ACCESS);
  assert.equal(app.name, 'NOWEN Community Staging Access');
  assert.equal(app.type, 'self_hosted');
  assert.deepEqual(app.destinations, [{ type: 'worker', worker_id: worker.tag }],
    'Access must cover ONLY the staging Worker (All traffic)');
  assert.ok(Array.isArray(policies) && policies.length === 1,
    'Require exactly one Access policy; no Bypass');
  const p = policies[0];
  assert.equal(p.decision, 'allow', 'Require Allow policy');
  assert.equal(p.include?.length, 1, 'Require one exact-email Include');
  assert.deepEqual(Object.keys(p.include[0]), ['email']);
  assert.match(p.include[0].email?.email || '', /^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  assert.equal(p.exclude?.length || 0, 0);
  assert.equal(widget.sitekey, stage.vars.TURNSTILE_SITE_KEY);
  assert.equal(widget.name, WORKER);
  assert.deepEqual(widget.domains, [HOST], 'Turnstile must be restricted to staging hostname');
  console.log('Phase 8 preflight PASS: staging bindings, Access, Turnstile and DNS are isolated.');
}
async function detachExactDomain() {
  const domains = await getDomains();
  ensureNoUnexpectedDomains(domains);
  const existing = target(domains);
  if (!existing) {
    console.log('Phase 8 domain already absent.');
    return;
  }
  assert.equal(existing.service, WORKER, 'Refusing to detach another Worker domain');
  assert.equal(existing.zone_id, ZONE, 'Refusing to detach a domain in another zone');
  assert.ok(existing.id, 'Missing custom domain ID');
  // Cloudflare can successfully delete a domain while returning HTTP 200
  // without a conventional {success:true} body. The read-after-write
  // absence check is the authoritative outcome.
  let deletionError=null;
  try { await cf(ROOT + '/workers/domains/' + encodeURIComponent(existing.id), 'DELETE'); }
  catch (error) { deletionError=error; }
  for (let attempt = 0; attempt < 12; attempt++) {
    if (!target(await getDomains())) {
      console.log('Phase 8 staging custom domain detached.');
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  throw new Error('Detach not confirmed; inspect Cloudflare Workers Domains immediately' + (deletionError ? ': ' + deletionError : ''));
}
function accessDenial(res, location, text) {
  const redirected = [301, 302, 303, 307, 308].includes(res.status);
  if (redirected && (/cloudflareaccess\.com/i.test(location) ||
      /\/cdn-cgi\/access\//i.test(location))) return true;
  return [401, 403].includes(res.status) &&
    /Cloudflare Access|You do not have access|Access denied/i.test(text);
}
async function assertAnonymousDenied() {
  for (const path of ['/', '/api/health']) {
    let last = 'no response';
    let denied = false;
    for (let attempt = 0; attempt < 24; attempt++) {
      try {
        const res = await fetch('https://' + HOST + path, {
          redirect: 'manual',
          headers: { Accept: 'text/html', 'Cache-Control': 'no-store' },
          signal: AbortSignal.timeout(10000),
        });
        const loc = res.headers.get('location') || '';
        const body = [401, 403].includes(res.status) ? (await res.text()).slice(0, 5000) : '';
        if (accessDenial(res, loc, body)) { denied = true; break; }
        if (res.status === 200) {
          throw new Error('FAIL OPEN: anonymous GET ' + path + ' returned HTTP 200');
        }
        last = 'HTTP ' + res.status + ' did not prove Cloudflare Access denial';
      } catch (error) {
        if (String(error).includes('FAIL OPEN')) throw error;
        last = String(error);
      }
      if (attempt < 23) await new Promise(resolve => setTimeout(resolve, 5000));
    }
    assert.ok(denied, 'Anonymous Access protection not proven on ' + path + ': ' + last);
    console.log('Anonymous Access denial verified:', path);
  }
}
if (ACTION === 'disable') {
  // Intentionally does not query Access; emergency close works if Access is broken.
  await detachExactDomain();
} else if (ACTION === 'check') {
  await verifyReadiness();
} else {
  await verifyReadiness();
  // Roll back even if the attach request times out after Cloudflare applies it.
  let attachAttempted = false;
  try {
    attachAttempted = true;
    await cf(ROOT + '/workers/domains', 'PUT', {
      hostname: HOST,
      service: WORKER,
      zone_id: ZONE,
      enabled: true,
      previews_enabled: false,
    });
    const domains = await getDomains();
    ensureNoUnexpectedDomains(domains);
    const attached = target(domains);
    assert.equal(attached?.service, WORKER);
    assert.equal(attached?.zone_id, ZONE);
    assert.equal(attached?.enabled, true);
    assert.equal(attached?.previews_enabled, false);
    await getSubdomain();
    await assertAnonymousDenied();
    console.log('PHASE 8 STAGING DOMAIN ACTIVE: https://' + HOST);
    console.log('Manual authorized sign-in and Turnstile workflow tests are still REQUIRED.');
  } catch (error) {
    if (attachAttempted) {
      try {
        await detachExactDomain();
        console.error('FAIL CLOSED: custom domain detached after failed validation.');
      } catch (rollbackError) {
        console.error('CRITICAL: rollback could not be confirmed; manually detach ' +
          HOST + ' from ' + WORKER + '. ' + String(rollbackError));
      }
    }
    throw error;
  }
}
