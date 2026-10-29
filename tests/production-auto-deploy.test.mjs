import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('production auto-deploy runs on main without Environment approval or staging hopping',()=>{
 const wf=read('.github/workflows/production-auto-deploy.yml');
 assert.match(wf,/push:\n    branches: \[main\]/);
 assert.match(wf,/npm run check/);
 assert.match(wf,/assert-production-build\.mjs/);
 assert.match(wf,/production-auto\.mjs check/);
 assert.match(wf,/production-auto\.mjs publish/);
 assert.match(wf,/npx wrangler deploy/);
 assert.doesNotMatch(wf,/environment:|CLOUDFLARE_ENV: staging|disable-domain|enable-protected-domain/);
});
test('production deployment pins correct Worker and resources and checks assets and secrets',()=>{
 const generated=read('scripts/assert-production-build.mjs');
 const script=read('scripts/production-auto.mjs');
 for(const v of ['nowen-community','ASSETS','workers_dev','DB','MEDIA','TURNSTILE_SITE_KEY']){
  assert.ok(generated.includes(v),'Missing build guard: '+v);
 }
 for(const v of ['community.nowen.cn','a63c9450-f93f-409d-adaf-313491e2bfc8','nowen-community-assets','PASSWORD_PEPPER','TURNSTILE_SECRET_KEY','ASSETS','0003_notifications.sql','previews_enabled:false']){
  assert.ok(script.includes(v),'Missing production preflight guard: '+v);
 }
 assert.doesNotMatch(script,/\/d1\/database\/.*?(?:DELETE|UPDATE|INSERT|migrations apply)/);
});
