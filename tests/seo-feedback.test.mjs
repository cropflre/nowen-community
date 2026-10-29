import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('published-only sitemap, robots privacy and OpenGraph share tags',()=>{
 const routes=read('src/worker/index.ts'),seo=read('src/worker/seo.ts');
 for(const name of ["/robots.txt","/sitemap.xml","eq(topics.status,'published')","Disallow: /api/"])assert.ok(routes.includes(name),name);
 for(const name of ['og:title','og:description','og:url','twitter:card'])assert.ok(seo.includes(name),name);
 const cfg=JSON.parse(read('wrangler.jsonc'));
 assert.ok(cfg.assets.run_worker_first.includes('/sitemap.xml'));
});
test('Product community feedback can open a GitHub Issue draft without embedded credentials',()=>{
 const ui=read('src/client/admin.tsx');
 for(const value of ['nowen-note','nowen-reader','nowen-video','/issues/new?','URLSearchParams','社区反馈原帖'])assert.ok(ui.includes(value),value);
 assert.doesNotMatch(ui,/GITHUB_TOKEN|GITHUB_PAT|api\.github\.com\/repos/);
});
