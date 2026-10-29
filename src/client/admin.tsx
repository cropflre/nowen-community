import React,{useCallback,useEffect,useState} from 'react';
type ReviewType='topic'|'reply'|'reports'|'uploads';
type QueueItem={id:string;title?:string;topicTitle?:string;content?:string;author?:string;createdAt:number;reason?:string;reporter?:string;type?:string;targetId?:string;contentType?:string;sizeBytes?:number};
type Counts={topics:number;replies:number;reports:number;uploads:number};
async function api<T>(url:string,method='GET',body?:unknown):Promise<T>{
 const response=await fetch('/api/v1'+url,{method,credentials:'same-origin',headers:{Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
 const result=await response.json() as {error?:string};
 if(!response.ok)throw new Error(result.error||('HTTP '+response.status));
 return result as T;
}
const names:{[key in ReviewType]:string}={topic:'待审主题',reply:'待审回复',reports:'举报处理',uploads:'图片审核'};
export function AdminPanel(){
 const [role,setRole]=useState<string|null>(null),[active,setActive]=useState<ReviewType>('topic');
 const [counts,setCounts]=useState<Counts>({topics:0,replies:0,reports:0,uploads:0});
 const [items,setItems]=useState<QueueItem[]>([]),[busy,setBusy]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const refresh=useCallback(async(kind:ReviewType)=>{setLoading(true);setError('');try{
   const [overview,listing]=await Promise.all([api<{counts:Counts}>('/admin/overview'),api<{items:QueueItem[]}>(kind==='reports'?'/admin/reports':kind==='uploads'?'/admin/uploads':'/admin/queue?type='+kind)]);
   setCounts(overview.counts);setItems(listing.items);
 }catch(e){setError(e instanceof Error?e.message:'加载失败')}finally{setLoading(false)}},[]);
 useEffect(()=>{api<{user:{role:string}|null}>('/me').then(d=>{setRole(d.user?.role||'guest');if(d.user?.role==='admin'||d.user?.role==='moderator')refresh(active)}).catch(()=>setRole('guest'))},[]);
 useEffect(()=>{if(role==='admin'||role==='moderator')refresh(active)},[active,role,refresh]);
 async function action(item:QueueItem,outcome:'approve'|'reject'|'resolved'|'dismissed'){
  const key=item.id+outcome;setBusy(key);setError('');
  try{
   if(active==='reports')await api('/admin/reports/'+encodeURIComponent(item.id)+'/resolve','POST',{outcome});
   else if(active==='uploads')await api('/admin/uploads/'+encodeURIComponent(item.id)+'/review','POST',{action:outcome});
   else await api('/admin/review','POST',{type:active,id:item.id,action:outcome});
   await refresh(active);
  }catch(e){setError(e instanceof Error?e.message:'操作失败')}finally{setBusy('')}
 }
 return <div className="admin-page"><header className="admin-top"><a href="/">← 返回社区</a><strong>NOWEN · 内容管理</strong><span>仅管理成员可访问</span></header><main className="admin-main">
  {role===null?<p>正在验证管理权限…</p>:(role!=='admin'&&role!=='moderator')?<section className="admin-empty"><h1>无访问权限</h1><p>当前账号不是社区管理员或版主。</p><a href="/">返回社区广场</a></section>:<>
    <div className="admin-heading"><div><small>MODERATION CENTER</small><h1>社区审核中心</h1><p>所有用户内容先审核，再向公开社区展示。</p></div><button onClick={()=>refresh(active)}>刷新列表</button></div>
    <div className="admin-kpis">{([['topic','topics'],['reply','replies'],['reports','reports'],['uploads','uploads']] as const).map(([kind,key])=><button key={kind} onClick={()=>setActive(kind)} className={kind===active?'active':''}><small>{names[kind]}</small><b>{counts[key]}</b></button>)}</div>
    <section className="admin-panel"><div className="admin-list-title"><h2>{names[active]}</h2><small>每页最多显示 60 条</small></div>
      {error&&<p className="member-error" role="alert">{error}</p>}
      {loading?<p className="admin-placeholder">正在加载…</p>:items.length===0?<p className="admin-placeholder">当前没有需要处理的内容</p>:items.map(item=><article className="admin-item" key={item.id}>
        <div className="admin-item-header"><b>{item.title||item.topicTitle||item.author||item.reporter||item.id}</b><small>{item.createdAt?new Date(item.createdAt*1000).toLocaleString('zh-CN'):''}</small></div>
        {item.content&&<pre>{item.content}</pre>}{item.reason&&<p>举报原因：{item.reason} · {item.type} / {item.targetId}</p>}
        {active==='uploads'&&<div className="admin-media"><p>{item.contentType} · {item.sizeBytes} bytes</p><img alt="待审核上传图片" loading="lazy" src={'/api/v1/media/'+encodeURIComponent(item.id)}/></div>}
        <div className="admin-item-actions">{active==='reports'?<>
          <button disabled={Boolean(busy)} onClick={()=>action(item,'resolved')}>标记已处理</button><button disabled={Boolean(busy)} onClick={()=>action(item,'dismissed')}>驳回举报</button>
        </>:<>
          <button disabled={Boolean(busy)} onClick={()=>action(item,'approve')}>审核通过</button><button className="danger" disabled={Boolean(busy)} onClick={()=>action(item,'reject')}>拒绝</button>
        </>}</div>
      </article>)}
    </section>
    <div className="admin-guidance">审核操作会保存审计记录。公开主题与回复不得绕过审核。图片仅支持经验证的 PNG、JPEG、WebP。</div>
  </>}
 </main></div>;
}
