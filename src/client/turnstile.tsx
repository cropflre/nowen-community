import React,{useEffect,useRef,useState} from 'react';
type WidgetApi={render:(el:HTMLElement,options:{sitekey:string;callback:(token:string)=>void;'expired-callback':()=>void;'error-callback':()=>void})=>string|number;remove:(id:string|number)=>void};
declare global{interface Window{turnstile?:WidgetApi}}
type Info={required:boolean;siteKey:string|null};
let sdkPromise:Promise<void>|null=null;
function loadSdk():Promise<void>{
 if(window.turnstile)return Promise.resolve();
 if(sdkPromise)return sdkPromise;
 sdkPromise=new Promise((resolve,reject)=>{
   let script=document.querySelector<HTMLScriptElement>('script[data-community-turnstile]');
   if(!script){script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.dataset.communityTurnstile='1';document.head.appendChild(script);}
   const loaded=()=>{script!.removeEventListener('load',loaded);script!.removeEventListener('error',failed);resolve()};
   const failed=()=>{script!.removeEventListener('load',loaded);script!.removeEventListener('error',failed);sdkPromise=null;reject(new Error('验证码加载失败'))};
   script.addEventListener('load',loaded);script.addEventListener('error',failed);
   if(window.turnstile)loaded();
 });
 return sdkPromise;
}
export function TurnstileField({onToken,revision=0}:{onToken:(token:string)=>void;revision?:number}){
 const target=useRef<HTMLDivElement>(null);
 const [config,setConfig]=useState<Info|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{let live=true;fetch('/api/v1/security/turnstile').then(async r=>{if(!r.ok)throw new Error('配置加载失败');return await r.json() as Info}).then(cfg=>{if(live)setConfig(cfg)}).catch(()=>{if(live)setError('暂时无法加载人机验证')});return()=>{live=false}},[]);
 useEffect(()=>{onToken('');if(!config?.required)return;if(!config.siteKey){setError('社区尚未配置 Turnstile，暂不能提交');return}
 let active=true;let widget:string|number|undefined;
 loadSdk().then(()=>{if(active&&window.turnstile&&target.current){widget=window.turnstile.render(target.current,{sitekey:config.siteKey!,callback:t=>onToken(t),'expired-callback':()=>onToken(''),'error-callback':()=>{onToken('');setError('验证失败，请刷新后重试')}})}}).catch(()=>{if(active)setError('验证码服务暂不可用')});
 return()=>{active=false;onToken('');if(widget!==undefined&&window.turnstile)window.turnstile.remove(widget)};
 },[config?.required,config?.siteKey,revision]);
 if(error)return <p className="member-error" role="alert">{error}</p>;
 if(config?.required)return <div className="turnstile-panel"><div ref={target}/><small>提交前请完成人机验证</small></div>;
 return <></>;
}
