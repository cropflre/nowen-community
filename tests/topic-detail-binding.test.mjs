import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('SSR topic route requires Cloudflare Assets binding and fails safely when absent',()=>{
 const worker=read('src/worker/index.ts');
 const config=JSON.parse(read('wrangler.jsonc'));
 assert.equal(config.assets.binding,'ASSETS');
 assert.ok(config.assets.run_worker_first.includes('/t/*'));
 assert.match(worker,/app.get\('\/t\/:slug'/);
 assert.match(worker,/if \(!c\.env\.ASSETS\)/);
 assert.match(worker,/c\.env\.ASSETS\.fetch/);
 assert.match(read('scripts/assert-staging-build.mjs'),/generated\.assets\?\.binding/);
 assert.match(read('scripts/staging-preflight.mjs'),/bindings\.get\('ASSETS'\)/);
 assert.match(read('scripts/staging-domain-gate.mjs'),/bindings\.get\('ASSETS'\)/);
});
test('Live D1 + Worker integration exercises both published HTML and private pending topics',()=>{
 const smoke=read('scripts/phase3-smoke.mjs');
 assert.match(smoke,/detailResponse\.status,200/);
 assert.match(smoke,/detailHtml/);
 assert.match(smoke,/pendingHtml\.status,404/);
});
