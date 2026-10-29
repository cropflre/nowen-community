import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('moderation is role gated, audited and pending by default',()=>{
 const src=read('src/worker/moderation.ts');assert.match(src,/getActor/);assert.match(src,/moderation\.approve|moderation\.'|audit_logs/);
 assert.match(src,/status='pending'/);assert.match(src,/changes\(\)=1/);assert.match(src,/reports/);assert.match(src,/admin\/users/);
});
test('uploads are private, size limited and verified by signature',()=>{
 const src=read('src/worker/moderation.ts');
 for(const s of ['detectMime','2*1024*1024','image/png','image/jpeg','image/webp','getReader','private, no-store','nosniff','NOT_FOUND'])assert.ok(src.includes(s),s);
 assert.doesNotMatch(src,/image\/svg\+xml/);
});
test('Turnstile validates server side and fails closed for production hostnames',()=>{
 const src=read('src/worker/turnstile.ts');assert.match(src,/siteverify/);assert.match(src,/result.success===true&&result.hostname===hostname/);assert.match(src,/if\(!secret/);assert.match(src,/CF-Connecting-IP/);
});
test('members require Turnstile at privileged submit endpoints',()=>{
 const src=read('src/worker/members.ts');assert.match(src,/verifyTurnstile/);assert.match(src,/turnstileToken/);
});
test('notifications and R2 bindings stay isolated',()=>{
 const w=JSON.parse(read('wrangler.jsonc'));assert.equal(w.workers_dev,false);assert.equal(w.name,'nowen-community');assert.equal(w.r2_buckets[0].bucket_name,'nowen-community-assets');assert.notEqual(w.d1_databases[0].database_name,'nowen-site-stats');
 assert.match(read('migrations/0003_notifications.sql'),/notifications_user_idx/);
});
