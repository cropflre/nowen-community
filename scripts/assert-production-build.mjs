#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const files=[];
function scan(dir){
 for(const entry of readdirSync(dir,{withFileTypes:true})){
  const p=join(dir,entry.name);
  if(entry.isDirectory())scan(p);else if(entry.name==='wrangler.json')files.push(p);
 }
}
scan('dist');
assert.equal(files.length,1,'Expected one generated Worker config: '+files.join(','));
const output=JSON.parse(readFileSync(files[0],'utf8'));
const cfg=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
assert.equal(output.name,'nowen-community','Refusing to deploy staging or another Worker');
assert.equal(output.workers_dev,false);
assert.equal(output.preview_urls,false);
assert.ok(!output.routes&&!output.route&&!output.custom_domain,'Domain must be managed independently');
assert.equal(output.assets?.binding,'ASSETS','Published topic SSR requires static assets');
assert.ok(output.assets?.run_worker_first?.includes('/t/*'),'Topic HTML must run through Worker');
assert.equal(output.d1_databases?.[0]?.database_id,cfg.d1_databases[0].database_id);
assert.equal(output.d1_databases?.[0]?.binding,'DB');
assert.equal(output.r2_buckets?.[0]?.bucket_name,'nowen-community-assets');
assert.equal(output.r2_buckets?.[0]?.binding,'MEDIA');
assert.equal(output.vars?.TURNSTILE_SITE_KEY,cfg.vars.TURNSTILE_SITE_KEY);
assert.equal(output.vars?.TURNSTILE_SECRET_KEY,undefined);
assert.equal(output.vars?.PASSWORD_PEPPER,undefined);
console.log('Production build PASS: correct Worker, D1/R2, static assets, Turnstile and no preview endpoints.');
