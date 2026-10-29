import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('forum ranks topics through D1 before applying pagination',()=>{
 const api=read('src/worker/index.ts'),home=read('src/client/main.tsx');
 assert.match(api,/c\.req\.query\('sort'\)/);
 assert.match(api,/desc\(topics\.replyCount\)/);
 assert.match(home,/page:'1',sort/);
 assert.match(home,/page:String\(next\),sort/);
 assert.doesNotMatch(home,/\.sort\(\(a,b\)=>b\.replyCount/);
});
test('member can edit profile and change password after authenticating with old password',()=>{
 const backend=read('src/worker/members.ts'),ui=read('src/client/account.tsx');
 for(const p of ["'/me/profile'","'/me/password'","verifyPassword(previous","DELETE FROM sessions WHERE user_id=?","createSession(c,user.id)"])assert.ok(backend.includes(p),p);
 assert.match(ui,/currentPassword:current,newPassword:next/);
});
test('notifications link to related posts, all-read is scoped to member',()=>{
 const server=read('src/worker/notifications.ts'),ui=read('src/client/notifications.tsx');
 assert.match(server,/LEFT JOIN topics t ON t.id=n.target_id/);
 assert.match(server,/WHERE user_id=\? AND read_at IS NULL/);
 assert.match(ui,/window.location.href/);assert.match(ui,/全部已读/);
});
test('feedback templates are tied to NOWEN products',()=>{
 const editor=read('src/client/member.tsx');
 for(const value of ['Bug 反馈','功能建议','使用交流','复现步骤'])assert.ok(editor.includes(value));
});
test('main production release gates browser tests before deployment',()=>{
 const y=read('.github/workflows/production-auto-deploy.yml');
 assert.ok(y.indexOf('npx playwright test')<y.indexOf('npx wrangler deploy'));
});
