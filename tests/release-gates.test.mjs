import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('release is manual and explicitly un-routed',()=>{const w=read('.github/workflows/release-community.yml');assert.match(w,/workflow_dispatch:/);assert.doesNotMatch(w,/^  push:/m);assert.match(w,/community-internal-release/);assert.match(w,/COMMUNITY_RELEASE_UNLOCK/);});
test('preflight verifies isolated database, bucket and migration ledger',()=>{const s=read('scripts/release-preflight.mjs');for(const word of ['nowen-community-db','nowen-community-assets','d1_migrations','0003_notifications.sql','community.nowen.cn'])assert.ok(s.includes(word));});
test('browser suite covers desktop and mobile',()=>{assert.match(read('playwright.config.ts'),/Desktop Chrome/);assert.match(read('playwright.config.ts'),/Pixel 7/);});
