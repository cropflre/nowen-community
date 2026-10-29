import React,{useEffect,useState} from 'react';
type Notice={id:string;kind:'topic_published'|'reply_approved';targetId:string;readAt:number|null;createdAt:number};
export function NotificationTray(){
 const [items,setItems]=useState<Notice[]>([]),[open,setOpen]=useState(false),[loading,setLoading]=useState(false);
 async function load(){setLoading(true);try{const r=await fetch('/api/v1/notifications',{credentials:'same-origin'});if(r.ok){const x=await r.json() as {items:Notice[]};setItems(x.items)}}finally{setLoading(false)}}
 useEffect(()=>{load().catch(()=>{})},[]);
 async function mark(id:string){const r=await fetch('/api/v1/notifications/'+encodeURIComponent(id)+'/read',{method:'POST',credentials:'same-origin'});if(r.ok)setItems(x=>x.map(n=>n.id===id?{...n,readAt:Date.now()/1000}:n))}
 const count=items.filter(n=>!n.readAt).length;
 return <div className="notices"><button className="small-icon" aria-expanded={open} aria-label={'通知中心，'+count+' 条未读'} onClick={()=>{setOpen(x=>!x);if(!open)load().catch(()=>{})}}>♧ {count>0&&<b>{count}</b>}</button>{open&&<section className="notice-panel" aria-label="通知列表"><div className="notice-heading"><b>消息通知</b><button onClick={()=>setOpen(false)} aria-label="关闭通知">×</button></div>{loading&&<p>加载中…</p>}{!loading&&!items.length&&<p>暂无通知</p>}{items.map(item=><button key={item.id} className={item.readAt?'notice':'notice unread'} onClick={()=>mark(item.id)}><strong>{item.kind==='topic_published'?'你的话题已经通过审核':'你参与的话题有新回复'}</strong><small>{new Date(item.createdAt*1000).toLocaleString('zh-CN')}{!item.readAt?' · 未读':''}</small></button>)}</section>}</div>;
}
