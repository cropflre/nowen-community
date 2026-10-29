#!/usr/bin/env node
/**
 * Fail closed if the Cloudflare Vite plugin generated a production build instead
 * of an isolated staging Worker. Invoked immediately before staging deployment.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const files = [];
function scan(dir) {
  for (const item of readdirSync(dir, {withFileTypes:true})) {
    const path = join(dir,item.name);
    if (item.isDirectory()) scan(path);
    else if (item.name === 'wrangler.json') files.push(path);
  }
}
scan('dist');
assert.equal(files.length, 1, 'Expected one generated Worker config, got: '+files.join(', '));
const generated = JSON.parse(readFileSync(files[0], 'utf8'));
const expected = JSON.parse(readFileSync('wrangler.jsonc','utf8')).env.staging;
assert.equal(generated.name,'nowen-community-staging');
assert.equal(generated.workers_dev,false);
assert.equal(generated.preview_urls,false);
assert.ok(!generated.routes && !generated.route && !generated.custom_domain);
assert.equal(generated.d1_databases?.[0]?.database_id,expected.d1_databases[0].database_id);
assert.equal(generated.d1_databases?.[0]?.binding,'DB');
assert.equal(generated.r2_buckets?.[0]?.bucket_name,expected.r2_buckets[0].bucket_name);
assert.equal(generated.r2_buckets?.[0]?.binding,'MEDIA');
assert.equal(generated.vars?.TURNSTILE_SITE_KEY,expected.vars.TURNSTILE_SITE_KEY);
assert.equal(generated.vars?.TURNSTILE_SECRET_KEY,undefined);
assert.equal(generated.vars?.LOCAL_TEST_TURNSTILE,undefined);
console.log('Staging build verified: isolated Worker, D1, R2, Turnstile, no public URLs.');
