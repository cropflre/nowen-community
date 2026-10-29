import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('dedicated Cloudflare Worker with isolated D1',()=>{
 const c=JSON.parse(read('wrangler.jsonc'));
 assert.equal(c.name,'nowen-community');
 assert.equal(c.workers_dev,false);
 assert.equal(c.d1_databases[0].database_name,'nowen-community-db');
 assert.deepEqual(c.assets.run_worker_first,['/api/*','/t/*']);
});
test('invite-only database schema and feed indexes',()=>{
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
test('UI labels invite beta instead of enabling unfinished flows',()=>{
 const ui=read('src/client/main.tsx');
 assert.ok(ui.includes('邀请制内测'));
 assert.ok(ui.includes('disabled>登录 / 注册'));
});
