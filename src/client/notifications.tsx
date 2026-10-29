import React,{useEffect,useState} from 'react';
type Notice={id:string;kind:'topic_published'|'reply_approved';targetId:string;slug:string|null;readAt:number|null;createdAt:number};
export function NotificationTray(){
 const [items,setItems]=useState<Notice[]>([]),[open,setOpen]=useState(false),[loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 async function load(){
  setLoading(true);
  try{
   const r=await fetch('/api/v1/notifications',{credentials:'same-origin'});
   if(!r.ok)throw new Error('加载通知失败');
   const data=await r.json() as {items:Notice[]};setItems(data.items);setError('');
  }catch{setError('通知加载失败，请重试')}finally{setLoading(false)}
 }
 useEffect(()=>{load().catch(()=>{})},[]);
 async function mark(item:Notice){
  try{
   if(!item.readAt){
    const r=await fetch('/api/v1/notifications/'+encodeURIComponent(item.id)+'/read',{method:'POST',credentials:'same-origin'});
    if(!r.ok)throw new Error();
    setItems(xs=>xs.map(n=>n.id===item.id?{...n,readAt:Date.now()/1000}:n));
   }
   if(item.slug)window.location.href='/t/'+encodeURIComponent(item.slug);
   else setError('原帖已不存在');
  }catch{setError('操作失败，请重试')}
 }
 async function allRead(){
  try{
   const r=await fetch('/api/v1/notifications/read-all',{method:'POST',credentials:'same-origin'});
   if(!r.ok)throw new Error();
   setItems(xs=>xs.map(n=>({...n,readAt:n.readAt??Date.now()/1000})));
  }catch{setError('操作失败，请重试')}
 }
 const unread=items.filter(x=>!x.readAt).length;
 return <div className="notices"><button className="small-icon" aria-expanded={open} aria-label={'通知中心，'+unread+' 条未读'} onClick={()=>{setOpen(x=>!x);if(!open)load().catch(()=>{})}}>♧ {unread>0&&<b>{unread}</b>}</button>
 {open&&<section className="notice-panel" aria-label="通知列表"><div className="notice-heading"><b>消息通知</b><div>{unread>0&&<button onClick={allRead} className="notice-all-read">全部已读</button>}<button onClick={()=>setOpen(false)} aria-label="关闭通知">×</button></div></div>
 {error&&<p role="alert">{error}</p>}{loading&&<p>加载中…</p>}{!loading&&!items.length&&<p>暂无通知</p>}
 {items.map(item=><button key={item.id} className={item.readAt?'notice':'notice unread'} onClick={()=>mark(item)}><strong>{item.kind==='topic_published'?'你的话题已经通过审核':'你参与的话题有新回复'}</strong><small>{new Date(item.createdAt*1000).toLocaleString('zh-CN')}{!item.readAt?' · 未读':''}</small></button>)}</section>}</div>;
}
