#!/usr/bin/env node
/**
 * Production auto deploy for the small NOWEN Community.
 * No staging approval loops; read-only preflight, then verify before attaching
 * the official domain. Do not modify schema, users or staging services.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const mode=process.argv[2];
assert.ok(['check','publish'].includes(mode),'Expected check or publish');
assert.ok(!process.env.CLOUDFLARE_ENV,'Do not deploy with CLOUDFLARE_ENV (staging)');
const config=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
const ACCOUNT='7363e4151dcbcf430e342b6119b92925';
const ZONE='90b0a9e005f9cefa4c19dcb2c281dcc3';
const HOST='community.nowen.cn';
const WORKER='nowen-community';
const DB='a63c9450-f93f-409d-adaf-313491e2bfc8';
const BUCKET='nowen-community-assets';
const SITE_KEY='0x4AAAAAAFqrMaE54L6wuOLe';
const TOKEN=process.env.CLOUDFLARE_API_TOKEN;
assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,ACCOUNT,'Wrong Cloudflare account');
assert.ok(TOKEN,'Missing Cloudflare API token');
assert.equal(config.name,WORKER);
assert.equal(config.d1_databases[0].database_id,DB);
assert.equal(config.d1_databases[0].binding,'DB');
assert.equal(config.r2_buckets[0].bucket_name,BUCKET);
assert.equal(config.r2_buckets[0].binding,'MEDIA');
assert.equal(config.vars.TURNSTILE_SITE_KEY,SITE_KEY);
assert.equal(config.assets.binding,'ASSETS');
assert.equal(config.workers_dev,false);
assert.equal(config.preview_urls,false);
assert.ok(!config.routes&&!config.route&&!config.custom_domain);

const API='https://api.cloudflare.com/client/v4';
const root='/accounts/'+ACCOUNT;
async function cf(path,method='GET',body){
 const response=await fetch(API+path,{
  method,headers:{Authorization:'Bearer '+TOKEN,'Content-Type':'application/json'},
  body:body===undefined?undefined:JSON.stringify(body),
  signal:AbortSignal.timeout(20000),
 });
 const data=await response.json().catch(()=>null);
 if(!response.ok||data?.success!==true){
  const codes=data?.errors?.map(x=>x.code).join(',')||'unknown';
  throw new Error('Cloudflare API '+method+' '+path+' returned HTTP '+response.status+' ('+codes+')');
 }
 return data.result;
}
function validateDomain(domains){
 const owned=domains.filter(x=>x.service===WORKER);
 assert.ok(owned.every(x=>x.hostname===HOST),'Unexpected production Worker custom domain');
 const candidates=domains.filter(x=>x.hostname===HOST);
 assert.ok(candidates.length<=1,'Duplicate production hostname bindings');
 if(candidates.length){
  assert.equal(candidates[0].service,WORKER,'Official hostname belongs to another Worker');
  assert.equal(candidates[0].zone_id,ZONE);
  assert.equal(candidates[0].previews_enabled,false);
 }
 return candidates[0]||null;
}
async function preflight(){
 const [database,bucket,migrations,settings,sub,domains,zone,widget]=await Promise.all([
  cf(root+'/d1/database/'+DB),
  cf(root+'/r2/buckets/'+BUCKET),
  cf(root+'/d1/database/'+DB+'/query','POST',{sql:'SELECT name FROM d1_migrations ORDER BY id ASC'}),
  cf(root+'/workers/scripts/'+WORKER+'/settings'),
  cf(root+'/workers/scripts/'+WORKER+'/subdomain'),
  cf(root+'/workers/domains'),
  cf('/zones/'+ZONE),
  cf(root+'/challenges/widgets/'+SITE_KEY),
 ]);
 assert.equal(database.name,'nowen-community-db');
 assert.equal(bucket.name,BUCKET);
 const migrationsDone=new Set((migrations?.[0]?.results||[]).map(x=>x.name));
 for(const name of ['0001_init.sql','0002_members.sql','0003_notifications.sql']){
  assert.ok(migrationsDone.has(name),'Production D1 missing migration '+name);
 }
 assert.equal(zone.name,'nowen.cn');
 assert.equal(zone.status,'active');
 assert.equal(sub.enabled,false,'Production workers.dev must stay disabled');
 assert.equal(sub.previews_enabled,false,'Production preview URLs must stay disabled');
 assert.equal(widget.sitekey,SITE_KEY);
 assert.ok(widget.domains.includes(HOST),'Turnstile must permit official hostname');
 const bindings=new Map((settings.bindings||[]).map(x=>[x.name,x]));
 assert.equal(bindings.get('DB')?.id,DB,'Wrong production D1 bound');
 assert.equal(bindings.get('MEDIA')?.bucket_name,BUCKET,'Wrong production R2 bound');
 assert.equal(bindings.get('TURNSTILE_SITE_KEY')?.text,SITE_KEY);
 assert.equal(bindings.get('TURNSTILE_SECRET_KEY')?.type,'secret_text','Missing Turnstile secret');
 assert.equal(bindings.get('PASSWORD_PEPPER')?.type,'secret_text','Missing production password pepper');
 const connected=validateDomain(domains);
 return {bindings,connected};
}
if(mode==='check'){
 await preflight();
 console.log('Production preflight PASS: production DB, R2, secrets, DNS and no preview routes.');
}else{
 const {bindings,connected}=await preflight();
 assert.equal(bindings.get('ASSETS')?.type,'assets','Missing deployed ASSETS: /t/:slug returns 500');
 if(!connected){
  await cf(root+'/workers/domains','PUT',{
   hostname:HOST,service:WORKER,zone_id:ZONE,
   enabled:true,previews_enabled:false,
  });
 }
 const domains=await cf(root+'/workers/domains');
 const attached=validateDomain(domains);
 assert.equal(attached?.enabled,true,'Production hostname not active');
 assert.equal(attached?.service,WORKER);
 console.log('Production Worker and domain verified: https://'+HOST);
}
