#!/usr/bin/env node
/**
 * Phase 7: Cloudflare Access-protected, temporary workers.dev test entry.
 *
 * check   -> read-only verification (does not enable a URL)
 * enable  -> verify strict Access and staging bindings, enable ONLY the staging
 *            workers.dev route, prove unauthenticated traffic gets Access login.
 *            On any failure, automatically disable the route again.
 * disable -> emergency shutdown, deliberately does NOT require Access API reads.
 *
 * Never touches production Worker, DNS records, routes or D1/R2 data.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ACTION = process.argv[2] || 'check';
assert.ok(['check','enable','disable'].includes(ACTION), 'Expected check, enable or disable');
const cfg = JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
const s = cfg.env?.staging;
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
assert.equal(ACCOUNT,'7363e4151dcbcf430e342b6119b92925','Refusing unexpected Cloudflare account');
assert.ok(TOKEN,'Missing Cloudflare API token');
assert.equal(cfg.name,'nowen-community');
assert.equal(cfg.workers_dev,false);
assert.equal(cfg.preview_urls,false);
assert.equal(s?.name,'nowen-community-staging');
assert.equal(s?.workers_dev,false);
assert.equal(s?.preview_urls,false);
assert.equal(s?.d1_databases?.[0]?.database_id,'073ece5c-4518-4d3c-a264-d9f976020554');
assert.equal(s?.r2_buckets?.[0]?.bucket_name,'nowen-community-staging-assets');
assert.ok(!s.route&&!s.routes&&!s.custom_domain,'Staging route must remain absent');
const worker='nowen-community-staging';
const root='/accounts/'+ACCOUNT;
const subdomainPath=root+'/workers/scripts/'+worker+'/subdomain';
const cfBase='https://api.cloudflare.com/client/v4';
async function cf(path,method='GET',body){
  const res=await fetch(cfBase+path,{
    method,
    headers:{Authorization:'Bearer '+TOKEN,'Content-Type':'application/json'},
    body:body===undefined?undefined:JSON.stringify(body),
    signal:AbortSignal.timeout(15000)
  });
  const data=await res.json().catch(()=>null);
  if(!res.ok||data?.success!==true){
    throw new Error('Cloudflare request failed: '+method+' '+path+' HTTP '+res.status+
      ' codes '+(data?.errors?.map(e=>e.code).join(',')||'unknown'));
  }
  return data.result;
}
async function change(enabled){
  const next=await cf(subdomainPath,'POST',{enabled,previews_enabled:false});
  const actual=await cf(subdomainPath);
  assert.equal(actual.enabled,enabled,'Worker URL update not reflected in Cloudflare');
  assert.equal(actual.previews_enabled,false,'Version URLs must remain disabled');
  return next;
}
async function verify(){
  const [workers,settings,subdomain,domains,routes,siteSubdomain]=await Promise.all([
    cf(root+'/workers/scripts'),
    cf(root+'/workers/scripts/'+worker+'/settings'),
    cf(subdomainPath),
    cf(root+'/workers/domains'),
    cf('/zones/90b0a9e005f9cefa4c19dcb2c281dcc3/workers/routes'),
    cf(root+'/workers/subdomain')
  ]);
  const item=workers.find(x=>x.id===worker);
  assert.ok(item?.tag,'Missing staging Worker');
  assert.equal(workers.find(x=>x.id==='nowen-community')?.id,'nowen-community');
  const b=new Map((settings.bindings||[]).map(x=>[x.name,x]));
  assert.equal(b.get('DB')?.id,'073ece5c-4518-4d3c-a264-d9f976020554');
  assert.equal(b.get('MEDIA')?.bucket_name,'nowen-community-staging-assets');
  assert.equal(b.get('TURNSTILE_SITE_KEY')?.text,s.vars.TURNSTILE_SITE_KEY);
  assert.equal(b.get('TURNSTILE_SECRET_KEY')?.type,'secret_text');
  assert.equal(subdomain.previews_enabled,false,'Version URLs must remain disabled');
  assert.ok(!domains.some(d=>d.hostname==='staging-community.nowen.cn'||d.service===worker),
    'Unexpected staging custom domain');
  assert.ok(!routes.some(r=>r.script===worker),'Unexpected staging Worker route');
  assert.ok(typeof siteSubdomain.subdomain==='string'&&siteSubdomain.subdomain.length>0);
  // Direct lookup prevents silently filtered Access app lists with scoped tokens.
  // This pinned ID is not a secret; the GitHub Cloudflare token still needs
  // Account → Access: Apps and Policies → Read.
  const accessId='d3894200-0bfe-4a51-aa41-aa98e93e2d98';
  let app;
  try {
    app=await cf(root+'/access/apps/'+accessId);
  } catch(error) {
    throw new Error('GitHub Cloudflare token cannot read pinned staging Access app: grant Account Access: Apps and Policies Read (or check token resource scope). '+String(error));
  }
  assert.equal(app.id,accessId,'Wrong staging Access application ID');
  assert.equal(app.name,'NOWEN Community Staging Access');
  assert.equal(app.type,'self_hosted');
  assert.deepEqual(app.destinations,[{type:'worker',worker_id:item.tag}],
    'Access must cover this Worker All traffic, and no other Worker');
  const policies=await cf(root+'/access/apps/'+app.id+'/policies');
  assert.equal(policies.length,1,'Require exactly one Access policy, no bypasses');
  const p=policies[0];
  assert.equal(p.decision,'allow','Require restrictive Allow policy');
  assert.equal(p.include?.length,1,'Require exactly one Allow selector');
  const rule=p.include[0];
  assert.deepEqual(Object.keys(rule),['email'],'Require one exact email only');
  assert.ok(typeof rule.email?.email==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rule.email.email));
  assert.equal(p.exclude?.length||0,0);
  // A policy with extra Require constraints remains more restrictive and is okay.
  const url='https://'+worker+'.'+siteSubdomain.subdomain+'.workers.dev';
  return {subdomain,url};
}
async function anonymousCheck(url){
  // Only redirects to Access login or a clearly identified Access rejection
  // count as protected. HTTP 200/5xx/404 and network failures fail closed.
  for(const path of ['/api/health','/']){
    let last='';
    let verified=false;
    for(let attempt=0;attempt<8;attempt++){
      try{
        const res=await fetch(url+path,{method:'GET',redirect:'manual',
          headers:{Accept:'text/html', 'Cache-Control':'no-cache'},
          signal:AbortSignal.timeout(9000)});
        const loc=res.headers.get('location')||'';
        if([301,302,303,307,308].includes(res.status) &&
            (/cloudflareaccess\.com/i.test(loc)||/\/cdn-cgi\/access\//i.test(loc))){
          verified=true;break;
        }
        if([401,403].includes(res.status)){
          const body=(await res.text()).slice(0,5000);
          if(/Cloudflare Access|You do not have access|Access denied/i.test(body)){
            verified=true;break;
          }
        }
        last='unexpected status '+res.status+' on '+path+' (location looks like Access login: '+
          (/cloudflareaccess\.com|\/cdn-cgi\/access\//i.test(loc))+')';
        if(res.status===200)throw new Error('FAIL OPEN: staging Worker returned HTTP 200 without Access');
      }catch(e){last=String(e);if(last.includes('FAIL OPEN'))throw e;}
      if(attempt<7)await new Promise(resolve=>setTimeout(resolve,2500));
    }
    assert.ok(verified,'Access anonymous rejection could not be proven on '+path+': '+last);
    console.log('Anonymous request rejected by Access:',path);
  }
}
if(ACTION==='disable'){
  await change(false);
  console.log('Emergency shutdown succeeded: staging workers.dev and Version URLs both disabled.');
}else if(ACTION==='check'){
  const state=await verify();
  assert.equal(state.subdomain.enabled,false,'Test URL already enabled; run enable to check anonymous access');
  console.log('Protected test-entry preflight PASS: strict Access, isolated staging resources, no ingress enabled.');
}else{
  let mustRollback=false;
  try{
    const state=await verify();
    mustRollback=true;
    await change(true);
    await anonymousCheck(state.url);
    mustRollback=false;
    console.log('PROTECTED PREVIEW ACTIVE:',state.url);
    console.log('Unauthenticated GET / and /api/health are rejected by Cloudflare Access.');
    console.log('Access sign-in can be tested manually. Turnstile requires the staging custom hostname later.');
  }catch(error){
    if(mustRollback){
      try{await change(false);console.error('FAIL CLOSED: test entry disabled after unsuccessful verification.');}
      catch(rollbackError){console.error('CRITICAL: automatic shutdown failed:',String(rollbackError));}
    }
    throw error;
  }
}
