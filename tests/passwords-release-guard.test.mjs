import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('staging and production deploys require separate pepper secrets',()=>{
 const s=read('.github/workflows/release-community-staging.yml'),p=read('.github/workflows/release-community.yml');
 assert.match(s,/COMMUNITY_STAGING_PASSWORD_PEPPER/);
 assert.match(p,/COMMUNITY_PASSWORD_PEPPER/);
 assert.doesNotMatch(s,/secrets\.COMMUNITY_PASSWORD_PEPPER/);
 assert.match(s,/secret put PASSWORD_PEPPER --name nowen-community-staging/);
 assert.match(p,/secret put PASSWORD_PEPPER/);
 assert.match(read('scripts/staging-preflight.mjs'),/bindings.get\('PASSWORD_PEPPER'\)/);
});
test('registration and login fail closed if password pepper is missing',()=>{
 const s=read('src/worker/members.ts');
 assert.match(s,/AUTH_UNAVAILABLE/);
 assert.match(s,/passwordHash\(password,pepper\)/);
 assert.match(s,/verifyPassword\(password,user.passwordHash,pepper\)/);
});
