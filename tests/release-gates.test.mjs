import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('release is manual and explicitly un-routed',()=>{const w=read('.github/workflows/release-community.yml');assert.match(w,/workflow_dispatch:/);assert.doesNotMatch(w,/^  push:/m);assert.match(w,/community-internal-release/);assert.match(w,/COMMUNITY_RELEASE_UNLOCK/);});
test('preflight verifies isolated database, bucket and migration ledger',()=>{const s=read('scripts/release-preflight.mjs');for(const word of ['nowen-community-db','nowen-community-assets','d1_migrations','0003_notifications.sql','community.nowen.cn'])assert.ok(s.includes(word));});
test('browser suite covers desktop and mobile',()=>{assert.match(read('playwright.config.ts'),/Desktop Chrome/);assert.match(read('playwright.config.ts'),/Pixel 7/);});

test('community Turnstile public site key is versioned, secret never committed',()=>{
 const w=JSON.parse(read('wrangler.jsonc'));
 assert.equal(w.vars.TURNSTILE_SITE_KEY,'0x4AAAAAAFqrMaE54L6wuOLe');
 assert.equal(w.vars.TURNSTILE_SECRET_KEY,undefined);
 const release=read('.github/workflows/release-community.yml');
 assert.match(release,/COMMUNITY_TURNSTILE_SECRET_KEY/);
 assert.doesNotMatch(release,/COMMUNITY_TURNSTILE_SITE_KEY/);
 assert.match(release,/wrangler secret put TURNSTILE_SECRET_KEY/);
});

test('staging is strictly separated from production resources and public ingress',()=>{
 const w=JSON.parse(read('wrangler.jsonc'));
 const s=w.env.staging;
 assert.equal(s.name,'nowen-community-staging');
 assert.equal(s.workers_dev,false);
 assert.equal(s.preview_urls,false);
 assert.equal(w.preview_urls,false);
 assert.notEqual(s.d1_databases[0].database_id,w.d1_databases[0].database_id);
 assert.notEqual(s.r2_buckets[0].bucket_name,w.r2_buckets[0].bucket_name);
 assert.notEqual(s.vars.TURNSTILE_SITE_KEY,w.vars.TURNSTILE_SITE_KEY);
 assert.equal(s.vars.TURNSTILE_SECRET_KEY,undefined);
 assert.equal(s.vars.LOCAL_TEST_TURNSTILE,undefined);
 assert.ok(!s.route && !s.routes && !s.custom_domain);
});
test('staging deploy requires manual selection, approval and staging-only secret',()=>{
 const y=read('.github/workflows/release-community-staging.yml');
 assert.match(y,/workflow_dispatch:/);
 assert.doesNotMatch(y,/^  push:/m);
 assert.match(y,/community-internal-release/);
 assert.match(y,/COMMUNITY_STAGING_TURNSTILE_SECRET_KEY/);
 assert.doesNotMatch(y,/secrets.COMMUNITY_TURNSTILE_SECRET_KEY/);
 assert.match(y,/CLOUDFLARE_ENV: staging/);
 assert.match(y,/assert-staging-build.mjs/);
 assert.match(y,/staging-preflight.mjs/);
 assert.match(y,/--name nowen-community-staging/);
 assert.ok(!y.includes('migrations apply'));
 const p=read('scripts/staging-preflight.mjs');
 assert.match(p,/nowen-community-staging-db/);
 assert.match(p,/nowen-community-staging-assets/);
 assert.match(p,/no public routes\/domains/);
});
