import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('registration and password change enforce 6-character minimum on server',()=>{
 const worker=read('src/worker/members.ts');
 assert.match(worker,/password\.length<6/);
 assert.match(worker,/next\.length<6/);
 assert.doesNotMatch(worker,/password\.length<12|next\.length<12/);
});
test('UI registration and account settings match six-character minimum',()=>{
 const auth=read('src/client/member.tsx');
 const account=read('src/client/account.tsx');
 assert.match(auth,/minLength=\{mode==='login'\?1:6\}/);
 assert.match(auth,/至少 6 位密码/);
 assert.match(account,/if\(next\.length<6\)/);
 assert.match(account,/minLength=\{6\}/);
 assert.match(account,/新密码（至少 6 位）/);
});
test('integration tests verify numeric six-character password and reject five characters',()=>{
 const smoke=read('scripts/phase2-smoke.mjs');
 const e2e=read('e2e/community.spec.ts');
 assert.match(smoke,/const password='638472'/);
 assert.match(smoke,/Registration must reject passwords shorter than 6 characters/);
 assert.match(smoke,/Password change must reject passwords shorter than 6 characters/);
 assert.match(e2e,/getByPlaceholder\('至少 6 位密码'\)\.fill\('638472'\)/);
});
