import React,{useCallback,useEffect,useState} from 'react';
type ReviewType='topic'|'reply'|'reports'|'uploads'|'content'|'users';
type Item={id:string;slug?:string;topicSlug?:string;title?:string;topicTitle?:string;content?:string;author?:string;username?:string;displayName?:string;role?:string;state?:string;status?:string;pinned?:number;createdAt:number;reason?:string;reporter?:string;type?:string;targetId?:string;targetPreview?:string;contentType?:string;sizeBytes?:number};
type Counts={topics:number;replies:number;reports:number;uploads:number};
const names:Record<ReviewType,string>={topic:'待审主题',reply:'待审回复',reports:'举报处理',uploads:'图片审核',content:'帖子管理',users:'用户管理'};
const errorText:Record<string,string>={FORBIDDEN:'当前账号无权执行此操作',NOT_PENDING:'该内容已被其他管理员处理',NOT_ALLOWED:'当前状态不允许该操作',NOT_OPEN:'举报已处理',ORIGIN_DENIED:'请求验证失败，请刷新后重试'};
async function api<T>(path:string,method='GET',body?:unknown):Promise<T>{
 const r=await fetch('/api/v1'+path,{method,credentials:'same-origin',headers:{Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await r.json().catch(()=>({error:'NETWORK_ERROR'})) as {error?:string};
 if(!r.ok)throw new Error(errorText[data.error||'']||data.error||'请求失败，请重试');
 return data as T;
}
export function AdminPanel(){
 const [role,setRole]=useState<string|null>(null),[active,setActive]=useState<ReviewType>('topic'),[contentStatus,setContentStatus]=useState<'published'|'hidden'>('published');
 const [counts,setCounts]=useState<Counts>({topics:0,replies:0,reports:0,uploads:0}),[items,setItems]=useState<Item[]>([]);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const refresh=useCallback(async(kind:ReviewType,status:'published'|'hidden'='published')=>{
  setLoading(true);setError('');
  try{
   const url=kind==='reports'?'/admin/reports':kind==='uploads'?'/admin/uploads':kind==='users'?'/admin/users':kind==='content'?'/admin/topics?status='+status:'/admin/queue?type='+kind;
   const [overview,listing]=await Promise.all([api<{counts:Counts}>('/admin/overview'),api<{items:Item[]}>(url)]);
   setCounts(overview.counts);setItems(listing.items);
  }catch(e){setError(e instanceof Error?e.message:'加载失败')}finally{setLoading(false)}
 },[]);
 useEffect(()=>{api<{user:{role:string}|null}>('/me').then(d=>setRole(d.user?.role||'guest')).catch(()=>setRole('guest'))},[]);
 useEffect(()=>{if(role==='admin'||role==='moderator')refresh(active,contentStatus)},[active,contentStatus,role,refresh]);
 async function execute(item:Item,operation:string){
  if(['hide','restore','suspend','unsuspend','reject'].includes(operation)){
   const prompts:Record<string,string>={hide:'隐藏这篇已发布帖子？',restore:'重新公开这篇帖子？',suspend:'封禁该普通用户并退出其所有会话？',unsuspend:'解除该用户的封禁？',reject:'确认驳回此内容？'};
   if(!window.confirm(prompts[operation]))return;
  }
  setBusy(true);setError('');setNotice('');
  try{
   if(active==='reports')await api('/admin/reports/'+encodeURIComponent(item.id)+'/resolve','POST',{outcome:operation});
   else if(active==='uploads')await api('/admin/uploads/'+encodeURIComponent(item.id)+'/review','POST',{action:operation});
   else if(active==='topic'||active==='reply')await api('/admin/review','POST',{type:active,id:item.id,action:operation});
   else if(active==='content')await api('/admin/topics/'+encodeURIComponent(item.id)+'/manage','POST',{action:operation});
   else await api('/admin/users/'+encodeURIComponent(item.id)+'/'+operation,'POST');
   setNotice('操作已完成');await refresh(active,contentStatus);
  }catch(e){setError(e instanceof Error?e.message:'操作失败')}finally{setBusy(false)}
 }
 const manageable=role==='admin';
 return <div className="admin-page"><header className="admin-top"><a href="/">← 返回社区</a><strong>NOWEN · 管理中心</strong><span>仅管理成员可访问</span></header><main className="admin-main">
 {role===null?<p>正在验证管理权限…</p>:(role!=='admin'&&role!=='moderator')?<section className="admin-empty"><h1>无访问权限</h1><p>当前账号不是社区管理员或版主。</p><a href="/">返回社区广场</a></section>:<>
  <div className="admin-heading"><div><small>COMMUNITY CONTROL</small><h1>社区管理中心</h1><p>内容审核、举报、帖子与用户管理，所有操作均保留审计记录。</p></div><button onClick={()=>refresh(active,contentStatus)}>刷新列表</button></div>
  <div className="admin-kpis">{([['topic','topics'],['reply','replies'],['reports','reports'],['uploads','uploads']] as const).map(([kind,key])=><button key={kind} onClick={()=>setActive(kind)} className={kind===active?'active':''}><small>{names[kind]}</small><b>{counts[key]}</b></button>)}</div>
  <nav className="admin-tabs" aria-label="管理模块"><button className={active==='content'?'active':''} onClick={()=>setActive('content')}>帖子管理</button>{manageable&&<button className={active==='users'?'active':''} onClick={()=>setActive('users')}>用户管理</button>}</nav>
  <section className="admin-panel"><div className="admin-list-title"><h2>{names[active]}</h2>{active==='content'?<select aria-label="帖子状态" value={contentStatus} onChange={e=>setContentStatus(e.target.value as 'published'|'hidden')}><option value="published">已发布</option><option value="hidden">已隐藏</option></select>:<small>最多显示 {active==='users'?100:60} 条</small>}</div>
  {notice&&<p className="admin-notice" role="status">{notice}</p>}{error&&<p className="member-error" role="alert">{error}</p>}
  {loading?<p className="admin-placeholder">正在加载…</p>:items.length===0?<p className="admin-placeholder">当前没有需要处理的内容</p>:items.map(item=><article className="admin-item" key={item.id}>
   <div className="admin-item-header"><b>{item.title||item.topicTitle||item.displayName||item.author||item.reporter||item.id}</b><small>{item.createdAt?new Date(item.createdAt*1000).toLocaleString('zh-CN'):''}</small></div>
   {(item.author||item.username)&&<small className="admin-meta">{item.author||item.username}{item.role?' · '+item.role:''}{item.state?' · '+(item.state==='active'?'正常':'已封禁'):''}</small>}
   {item.content&&<pre>{item.content}</pre>}
   {item.reason&&<p>举报原因：{item.reason}</p>}
   {item.targetPreview&&<pre>被举报内容：{item.targetPreview}</pre>}
   {item.topicSlug&&<a className="admin-topic-link" href={'/t/'+encodeURIComponent(item.topicSlug)} target="_blank" rel="noopener noreferrer">查看原帖</a>}
   {item.slug&&<a className="admin-topic-link" href={'/t/'+encodeURIComponent(item.slug)} target="_blank" rel="noopener noreferrer">查看原帖</a>}
   {active==='uploads'&&<div className="admin-media"><p>{item.contentType} · {item.sizeBytes} bytes</p><img alt="待审核上传图片" loading="lazy" src={'/api/v1/media/'+encodeURIComponent(item.id)}/></div>}
   <div className="admin-item-actions">
    {active==='reports'?<><button disabled={busy} onClick={()=>execute(item,'resolved')}>标记已处理</button><button disabled={busy} onClick={()=>execute(item,'dismissed')}>驳回举报</button></>:
     active==='content'?item.status==='hidden'?<button disabled={busy} onClick={()=>execute(item,'restore')}>恢复公开</button>:<><button disabled={busy} onClick={()=>execute(item,item.pinned?'unpin':'pin')}>{item.pinned?'取消置顶':'置顶'}</button><button className="danger" disabled={busy} onClick={()=>execute(item,'hide')}>隐藏帖子</button></>:
     active==='users'?item.role==='member'?(item.state==='active'?<button className="danger" disabled={busy} onClick={()=>execute(item,'suspend')}>封禁用户</button>:<button disabled={busy} onClick={()=>execute(item,'unsuspend')}>解除封禁</button>):<small>管理员账号不可操作</small>:
     <><button disabled={busy} onClick={()=>execute(item,'approve')}>审核通过</button><button className="danger" disabled={busy} onClick={()=>execute(item,'reject')}>拒绝</button></>}
   </div>
  </article>)}
  </section>
  <p className="admin-guidance">公开帖子隐藏后将无法通过列表及公开接口访问；用户封禁会撤销其现有会话。</p>
 </>}
 </main></div>;
}
