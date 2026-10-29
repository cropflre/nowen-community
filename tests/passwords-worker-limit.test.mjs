import test from 'node:test';
import assert from 'node:assert/strict';
import {PASSWORD_ROUNDS,passwordHash,verifyPassword} from '../src/worker/passwords.ts';
const pepper='local-only-password-pepper-for-tests-do-not-deploy-2026';
test('Workers-compatible salted/peppered password hash and verification',async()=>{
 assert.equal(PASSWORD_ROUNDS,100_000);
 const password='a long secure password, only for this test';
 const a=await passwordHash(password,pepper);
 const b=await passwordHash(password,pepper);
 assert.notEqual(a,b,'Each hash must have a unique random salt');
 assert.match(a,/^pbkdf2-sha256-hmac-pepper:100000:[0-9a-f]{32}:[0-9a-f]{64}$/);
 assert.equal(await verifyPassword(password,a,pepper),true);
 assert.equal(await verifyPassword('bad password',a,pepper),false);
 assert.equal(await verifyPassword(password,a,pepper+'-another'),false);
});
test('Missing pepper and unsupported legacy format fail closed',async()=>{
 await assert.rejects(passwordHash('test password',''),/PASSWORD_PEPPER/);
 await assert.rejects(verifyPassword('test password','corrupt',''),/PASSWORD_PEPPER/);
 assert.equal(await verifyPassword('test password','pbkdf2-sha256:600000:abc:def',pepper),false);
});
