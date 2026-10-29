#!/usr/bin/env node
/**
 * Read-only Cloudflare release preflight.
 * Never creates resources, applies migrations, deploys a Worker or changes DNS.
 */
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';

const config=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
const token=process.env.CLOUDFLARE_API_TOKEN;
const account=process.env.CLOUDFLARE_ACCOUNT_ID;
if(!account||!token)throw new Error('Missing Cloudflare API token / account ID; no release allowed.');
assert.equal(config.name,'nowen-community');
assert.equal(config.workers_dev,false,'Workers dev must remain disabled');
assert.equal(config.d1_databases.length,1);
assert.equal(config.d1_databases[0].database_name,'nowen-community-db');
assert.equal(config.r2_buckets?.[0]?.bucket_name,'nowen-community-assets');
const database=config.d1_databases[0].database_id;
assert.match(database,/^[a-f0-9-]{36}$/);
const base='https://api.cloudflare.com/client/v4';
async function cf(path,method='GET',body){
  const response=await fetch(base+path,{
    method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:body===undefined?undefined:JSON.stringify(body),
    signal:AbortSignal.timeout(12000)
  });
  const payload=await response.json().catch(()=>null);
  if(!response.ok||payload?.success!==true){
    const code=payload?.errors?.map(e=>e.code).join(',')||'unknown';
    throw new Error('Cloudflare preflight blocked ('+response.status+', '+code+'): '+path.split('?')[0]);
  }
  return payload.result;
}
const db=await cf('/accounts/'+account+'/d1/database/'+database);
assert.equal(db.name,'nowen-community-db','Refusing wrong D1 database');
const [tablesResponse,r2]=await Promise.all([
  cf('/accounts/'+account+'/d1/database/'+database+'/query','POST',{
    sql:"SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users','topics','replies','invitations','sessions','audit_logs','notifications','request_limits')"
  }),
  cf('/accounts/'+account+'/r2/buckets/nowen-community-assets')
]);
assert.equal(r2.name,'nowen-community-assets');
const names=new Set((tablesResponse?.[0]?.results||[]).map(x=>x.name));
for(const table of ['users','topics','replies','invitations','sessions','audit_logs','notifications','request_limits']){
 assert.ok(names.has(table),'Missing D1 table: '+table+'; apply reviewed migrations after backup first');
}
const migrationResult=await cf('/accounts/'+account+'/d1/database/'+database+'/query','POST',{
 sql:"SELECT name FROM sqlite_master WHERE type='table' AND name='d1_migrations'"
});
const tracked=(migrationResult?.[0]?.results||[]).length>0;
assert.ok(tracked,'No tracked D1 migrations; reconcile manually initialized schema before release');
const pending=await cf('/accounts/'+account+'/d1/database/'+database+'/query','POST',{
 sql:"SELECT name FROM d1_migrations ORDER BY id ASC"
});
const applied=new Set((pending?.[0]?.results||[]).map(x=>x.name));
for(const name of ['0001_init.sql','0002_members.sql','0003_notifications.sql']){
 assert.ok(applied.has(name),'D1 migration not tracked: '+name);
}
const workerRoutes=await cf('/zones/90b0a9e005f9cefa4c19dcb2c281dcc3/workers/routes');
assert.ok(!(workerRoutes||[]).some(r=>r.script==='nowen-community'),'Public Worker route exists');
const domains=await cf('/accounts/'+account+'/workers/domains');
const connected=(domains||[]).filter(x=>x.hostname==='community.nowen.cn');
assert.equal(connected.length,0,'Production custom domain already attached: disable staging deploy until explicitly reviewed');
console.log('Cloudflare release preflight PASS: isolated DB, migration ledger, R2 bucket, no production hostname binding.');
