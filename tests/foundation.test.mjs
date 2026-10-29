import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('dedicated Cloudflare Worker with isolated D1',()=>{
 const c=JSON.parse(read('wrangler.jsonc'));
 assert.equal(c.name,'nowen-community');
 assert.equal(c.workers_dev,false);
 assert.equal(c.d1_databases[0].database_name,'nowen-community-db');
 assert.deepEqual(c.assets.run_worker_first,['/api/*','/t/*','/robots.txt','/sitemap.xml']);
 assert.equal(c.assets.binding,'ASSETS','Server-rendered topic detail needs static template binding');
});
test('backward-compatible database schema and feed indexes',()=>{
 const sql=read('migrations/0001_init.sql');
 for(const n of ['users','invitations','sessions','categories','topics','replies','topic_likes','bookmarks','reports','audit_logs','uploads'])
   assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS '+n+' '),n);
 assert.match(sql,/topics_feed_idx/);
 assert.match(sql,/topics_category_idx/);
});
test('write APIs remain disabled in Phase 1',()=>{
 const api=read('src/worker/index.ts');
 assert.ok(api.includes("eq(topics.status, 'published')"));
 assert.ok(api.includes("app.all('/api/*'"));
 assert.ok(!api.includes('app.post('));
});
test('UI reflects open registration with content moderation',()=>{
 const ui=read('src/client/main.tsx');
 assert.ok(ui.includes('开放注册 · 内容先审'));
 assert.ok(ui.includes('AuthDialog'));
 assert.ok(ui.includes('TopicEngagement'));
});
