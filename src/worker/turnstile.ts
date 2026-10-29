import type { Context } from 'hono';
import type { CommunityBindings } from './security';
type C=Context<{Bindings:CommunityBindings}>;
export const localRequest=(c:C)=>c.env.LOCAL_TEST_TURNSTILE==='1'&&['localhost','127.0.0.1','[::1]'].includes(new URL(c.req.url).hostname)&&new URL(c.req.url).protocol==='http:';
export const turnstileRequired=(c:C)=>!localRequest(c);
export async function verifyTurnstile(c:C,token:unknown):Promise<boolean>{
  if(!turnstileRequired(c)) return true;
  const secret=c.env.TURNSTILE_SECRET_KEY;
  if(!secret||typeof token!=='string'||token.length<10||token.length>2048)return false;
  try {
    const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
      method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({secret,response:token,...(c.req.header('CF-Connecting-IP')?{remoteip:c.req.header('CF-Connecting-IP')!}:{})}),
      signal:AbortSignal.timeout(7000),
    });
    if(!response.ok)return false;
    const result=await response.json() as {success?:boolean;hostname?:string};
    const hostname=new URL(c.req.url).hostname;
    return result.success===true&&result.hostname===hostname;
  }catch{return false;}
}
