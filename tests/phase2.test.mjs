import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('security: high-cost salted password storage, hashed sessions, HttpOnly cookie',()=>{
 const s=read('src/worker/security.ts');assert.match(s,/rounds=600000/);assert.match(s,/PBKDF2/);assert.match(s,/sha256\(token\)/);assert.match(s,/HttpOnly/);assert.match(s,/SameSite=Lax/);assert.match(s,/denyCrossSite/);
});
test('invite and write APIs are gated and review only',()=>{
 const s=read('src/worker/members.ts');assert.match(s,/rateLimit\(c,'register'/);assert.match(s,/c.env.DB.batch/);assert.match(s,/WHERE EXISTS/);assert.match(s,/used_by IS NULL/);assert.match(s,/status='pending'/);assert.match(s,/requestKey|Idempotency-Key/);
});
test('only additive phase2 migrations; no production deployment',()=>{
 const m=read('migrations/0002_members.sql');assert.match(m,/request_limits/);assert.match(m,/client_key/);const w=JSON.parse(read('wrangler.jsonc'));assert.equal(w.workers_dev,false);assert.equal(w.name,'nowen-community');
});
test('client includes accessible auth and moderated editor with markdown',()=>{
 const m=read('src/client/member.tsx');assert.match(m,/aria-modal="true"/);assert.match(m,/ReactMarkdown/);assert.match(m,/草稿/);assert.match(m,/审核/);assert.doesNotMatch(m,/dangerouslySetInnerHTML/);
});
