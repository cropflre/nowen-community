import React,{useEffect,useRef,useState} from 'react';
import ReactMarkdown from 'react-markdown';
import {TurnstileField} from './turnstile';
import remarkGfm from 'remark-gfm';
type Member={id:string;username:string;displayName:string;role:string};
type Category={id:string;name:string};
export type MyTopic={id:string;slug:string;title:string;content:string;categoryId:string;status:'draft'|'pending'|'published'|'hidden';updatedAt:number};
const request=async <T,>(path:string,method='GET',body?:unknown,requestKey?:string):Promise<T>=>{
 const headers:Record<string,string>={Accept:'application/json'};
 if(body!==undefined)headers['Content-Type']='application/json';
 if(requestKey)headers['Idempotency-Key']=requestKey;
 const response=await fetch(path,{method,headers,credentials:'same-origin',body:body===undefined?undefined:JSON.stringify(body)});
 const value=await response.json().catch(()=>({error:'NETWORK_ERROR'})) as Record<string,unknown>;
 if(!response.ok)throw new Error(String(value.error||('HTTP '+response.status)));return value as T;
};
export function useMember(){const [member,setMember]=useState<Member|null>(null);const [loading,setLoading]=useState(true);useEffect(()=>{let live=true;request<{user:Member|null}>('/api/v1/me').then(d=>{if(live)setMember(d.user)}).catch(()=>{}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[]);return {member,setMember,loading};}
export function AuthDialog({onClose,onAuthenticated}:{onClose:()=>void;onAuthenticated:(member:Member)=>void}){
 const [mode,setMode]=useState<'login'|'register'>('login');
 const [username,setUsername]=useState(''),[displayName,setDisplayName]=useState(''),[password,setPassword]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [token,setToken]=useState(''),[revision,setRevision]=useState(0);
 async function submit(event:React.FormEvent){event.preventDefault();setBusy(true);setError('');try{const result=await request<{user:Member}>('/api/v1/auth/'+(mode==='login'?'login':'register'),'POST',mode==='login'?{username,password,turnstileToken:token}:{username,displayName,password,turnstileToken:token});onAuthenticated(result.user);onClose();}catch(e){setError(e instanceof Error?e.message:'请求失败');setRevision(x=>x+1)}finally{setBusy(false)}}
 return <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section role="dialog" aria-modal="true" aria-labelledby="auth-title" className="member-dialog"><button className="member-close" onClick={onClose} aria-label="关闭">×</button><h2 id="auth-title">{mode==='login'?'欢迎回到弄文社区':'欢迎加入弄文社区'}</h2><p>开放注册 · 通过安全验证即可加入；发布的话题需审核后展示。</p><div className="auth-switch"><button className={mode==='login'?'active':''} onClick={()=>{setMode('login');setError('')}}>登录</button><button className={mode==='register'?'active':''} onClick={()=>{setMode('register');setError('')}}>免费注册</button></div><form onSubmit={submit}>
 <label>用户名<input required autoComplete="username" maxLength={24} minLength={3} value={username} onChange={e=>setUsername(e.target.value)} placeholder="英文字母、数字或下划线"/></label>
 {mode==='register'&&<label>昵称<input required maxLength={32} minLength={2} value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="在社区展示的名称"/></label>}
 <label>密码<input required type="password" autoComplete={mode==='login'?'current-password':'new-password'} minLength={mode==='login'?1:12} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode==='login'?'输入密码':'至少 12 位密码'}/></label>
 
 <TurnstileField revision={revision} onToken={setToken}/>{error&&<p className="member-error" role="alert">{error}</p>}<button className="member-primary" disabled={busy} type="submit">{busy?'正在处理…':mode==='login'?'登录社区':'创建账号'}</button>
 </form></section></div>
}
const draftKey=(id:string)=>'nowen-community-draft:'+id;
const statusText:Record<MyTopic['status'],string>={draft:'草稿',pending:'等待审核',published:'已发布',hidden:'未通过审核'};
export function MyTopicsDialog({onClose,onEdit}:{onClose:()=>void;onEdit:(item:MyTopic)=>void}){
 const [items,setItems]=useState<MyTopic[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const load=async()=>{setLoading(true);try{const data=await request<{items:MyTopic[]}>('/api/v1/me/topics');setItems(data.items);setError('')}catch(e){setError(e instanceof Error?e.message:'加载失败')}finally{setLoading(false)}};
 useEffect(()=>{load().catch(()=>{})},[]);
 async function remove(item:MyTopic){
  if(!window.confirm('确定删除这篇草稿吗？删除后无法恢复。'))return;
  try{await request('/api/v1/me/topics/'+encodeURIComponent(item.id),'DELETE');setItems(rows=>rows.filter(x=>x.id!==item.id));}catch(e){setError(e instanceof Error?e.message:'删除失败')}
 }
 return <div className="modal-backdrop" role="presentation"><section className="member-dialog my-topics" role="dialog" aria-modal="true" aria-labelledby="my-topics-heading"><button className="member-close" aria-label="关闭" onClick={onClose}>×</button>
  <h2 id="my-topics-heading">我的帖子</h2><p>集中查看草稿、审核进度及已发布内容。</p>
  {error&&<p className="member-error" role="alert">{error}</p>}
  {loading?<p className="member-note">正在读取帖子…</p>:items.length===0?<p className="member-note">还没有帖子。可以从首页开启一个话题。</p>:
   <div className="my-topic-list">{items.map(item=><article className="my-topic" key={item.id}><div><strong>{item.title||'未命名草稿'}</strong><small>{statusText[item.status]} · {new Date(item.updatedAt*1000).toLocaleString('zh-CN')}</small></div><div className="my-topic-actions">{item.status==='draft'?<><button onClick={()=>onEdit(item)}>继续编辑</button><button className="danger-text" onClick={()=>remove(item)}>删除草稿</button></>:item.status==='published'?<a href={'/t/'+encodeURIComponent(item.slug)}>查看帖子</a>:<small>{item.status==='pending'?'通过审核后公开展示':'该内容未公开，如需协助请联系管理员'}</small>}</div></article>)}</div>}
 </section></div>
}
export function ComposerDialog({member,categories,onClose,initialDraft}:{member:Member;categories:Category[];onClose:()=>void;initialDraft?:MyTopic|null}){
 const stored=initialDraft??(()=>{try{const v=localStorage.getItem(draftKey(member.id));return v?JSON.parse(v) as {id?:string;key?:string;title?:string;content?:string;categoryId?:string}:null}catch{return null}})();
 const [title,setTitle]=useState(stored?.title||''),[content,setContent]=useState(stored?.content||''),[categoryId,setCategoryId]=useState(stored?.categoryId||categories[0]?.id||''),[id,setId]=useState(stored?.id||'');
 const [key]=useState((stored&&'key' in stored?stored.key:undefined)||crypto.randomUUID()),[saving,setSaving]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[preview,setPreview]=useState(false);
 const [token,setToken]=useState(''),[revision,setRevision]=useState(0),[uploaded,setUploaded]=useState<string[]>([]);
 const [uploading,setUploading]=useState(false);
 const textarea=useRef<HTMLTextAreaElement>(null);
 const serverId=useRef(stored?.id||'');
 const queue=useRef<Promise<string>>(Promise.resolve(serverId.current));
 const completed=useRef(false);
 useEffect(()=>{if(!completed.current)localStorage.setItem(draftKey(member.id),JSON.stringify({id,key,title,content,categoryId}))},[member.id,id,key,title,content,categoryId]);
 // Serialize all writes: a slow autosave cannot overwrite a newer submit or edit.
 function persist(){
  const snapshot={title,content,categoryId};
  if(!snapshot.categoryId)return Promise.resolve('');
  setSaving(true);
  const next=queue.current.catch(()=>serverId.current).then(async()=>{
   if(!serverId.current){
    const result=await request<{item:{id:string}}>('/api/v1/topics','POST',snapshot,key);
    serverId.current=result.item.id;setId(result.item.id);
   }else await request('/api/v1/topics/'+encodeURIComponent(serverId.current),'PUT',snapshot);
   return serverId.current;
  });
  queue.current=next;
  return next.finally(()=>{if(queue.current===next)setSaving(false)});
 }
 useEffect(()=>{if(!categoryId||completed.current)return;const timer=setTimeout(()=>{persist().then(()=>setMessage('草稿已保存')).catch(()=>setMessage('自动保存失败，请检查网络'))},900);return()=>clearTimeout(timer);},[title,content,categoryId,id]);
 function insertMarkdown(before:string,after=''){
  const el=textarea.current,start=el?.selectionStart??content.length,end=el?.selectionEnd??content.length;
  const selection=content.slice(start,end);
  setContent(value=>value.slice(0,start)+before+selection+after+value.slice(end));
  requestAnimationFrame(()=>{el?.focus();el?.setSelectionRange(start+before.length,start+before.length+selection.length)});
 }
 async function submit(){if(title.trim().length<5||content.trim().length<10){setMessage('标题至少 5 字，正文至少 10 字');return;}setBusy(true);try{const current=await persist();if(!current)return;await request('/api/v1/topics/'+encodeURIComponent(current)+'/submit','POST',{turnstileToken:token});completed.current=true;localStorage.removeItem(draftKey(member.id));setMessage('已提交审核，审核通过后其他用户才能看到');setTimeout(onClose,1300);}catch(e){setMessage(e instanceof Error?e.message:'提交失败');setRevision(x=>x+1)}finally{setBusy(false)}}
 async function uploadImage(file:File){
  setUploading(true);setMessage('图片上传中…');
  try{
   if(file.size>2*1024*1024)throw new Error('图片不能超过 2 MB');
   const result=await fetch('/api/v1/uploads',{method:'POST',credentials:'same-origin',headers:{'Content-Type':file.type,'X-Turnstile-Token':token},body:file});
   const data=await result.json() as {id?:string;error?:string};
   if(!result.ok||!data.id)throw new Error(data.error||'上传失败');
   const img='![图片](/api/v1/media/'+encodeURIComponent(data.id)+')';
   setContent(old=>old+(old.endsWith('\n')||old.length===0?'\n':'\n\n')+img+'\n');
   setUploaded(old=>[...old,data.id!]);
   setMessage('图片已插入正文；图片审核通过后其他用户才能查看');
  }catch(e){setMessage(e instanceof Error?e.message:'上传失败')}finally{setUploading(false);setRevision(x=>x+1)}
 }
 return <div className="modal-backdrop" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="compose-title" className="member-dialog composer"><button className="member-close" onClick={onClose} aria-label="关闭">×</button><h2 id="compose-title">发布新话题</h2><p>支持 Markdown，草稿自动保存；提交后先进入审核。</p><label>社区板块<select value={categoryId} onChange={e=>setCategoryId(e.target.value)}>{categories.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>标题<input maxLength={160} value={title} onChange={e=>setTitle(e.target.value)} placeholder="用一句话描述你想讨论的事情"/></label><label htmlFor="community-editor">正文</label><div className="editor-toolbar" aria-label="Markdown 工具栏"><button type="button" onClick={()=>insertMarkdown('**','**')}>加粗</button><button type="button" onClick={()=>insertMarkdown('*','*')}>斜体</button><button type="button" onClick={()=>insertMarkdown('- ')}>列表</button><button type="button" onClick={()=>insertMarkdown('[文字](',')')}>链接</button></div><textarea id="community-editor" aria-label="正文" ref={textarea} rows={9} maxLength={12000} value={content} onChange={e=>setContent(e.target.value)} placeholder="分享你的想法，支持 Markdown 语法…"/><label className="upload-field">图片上传（2MB 内，自动插入正文）<input type="file" disabled={uploading} accept="image/png,image/jpeg,image/webp" onChange={e=>{const file=e.target.files?.[0];if(file)uploadImage(file);e.target.value=''}}/></label>{uploaded.length>0&&<small>本次插入 {uploaded.length} 张图片，图片审核通过后其他用户才能查看</small>}<div className="compose-preview"><button onClick={()=>setPreview(!preview)}>{preview?'返回编辑':'预览 Markdown'}</button>{preview&&<div className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown></div>}</div><TurnstileField revision={revision} onToken={setToken}/><div className="composer-bottom"><small role="status">{saving?'保存中…':message||'草稿将在停止输入后自动保存'}</small><button className="member-primary" onClick={submit} disabled={busy||saving}>{busy?'提交中…':'提交审核'}</button></div></section></div>
}
export function TopicEngagement({id,slug,member,onLogin}:{id:string;slug:string;member:Member|null;onLogin:()=>void}){
 const [replies,setReplies]=useState<{id:string;content:string;status:string;author:string;createdAt:number}[]>([]);
 const [content,setContent]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const [liked,setLiked]=useState(false),[bookmarked,setBookmarked]=useState(false);
 const [token,setToken]=useState(''),[revision,setRevision]=useState(0),[reportReason,setReportReason]=useState(''),[reportOpen,setReportOpen]=useState(false);
 useEffect(()=>{request<{items:typeof replies}>('/api/v1/topics/'+encodeURIComponent(slug)+'/replies').then(d=>setReplies(d.items)).catch(()=>{})},[slug,member?.id]);
 async function reply(){if(!member){onLogin();return;}setBusy(true);try{const result=await request<{item:{status:string}}>('/api/v1/topics/'+encodeURIComponent(slug)+'/replies','POST',{content,turnstileToken:token},crypto.randomUUID());setContent('');setMessage('回复已提交审核');const d=await request<{items:typeof replies}>('/api/v1/topics/'+encodeURIComponent(slug)+'/replies');setReplies(d.items)}catch(e){setMessage(e instanceof Error?e.message:'发送失败')}finally{setBusy(false);setRevision(x=>x+1)}}
 async function reaction(type:'like'|'bookmark',active:boolean){if(!member){onLogin();return;}try{await request('/api/v1/topics/'+encodeURIComponent(id)+'/'+type,active?'DELETE':'POST');type==='like'?setLiked(!active):setBookmarked(!active);}catch(e){setMessage(e instanceof Error?e.message:'操作失败')}}
 async function report(){if(!member){onLogin();return;}try{await request('/api/v1/reports','POST',{type:'topic',targetId:id,reason:reportReason});setReportOpen(false);setReportReason('');setMessage('举报已提交给管理员')}catch(e){setMessage(e instanceof Error?e.message:'提交失败')}}
 return <div className="engagement"><div className="engagement-actions"><button onClick={()=>reaction('like',liked)}>{liked?'♥ 已点赞':'♡ 点赞'}</button><button onClick={()=>reaction('bookmark',bookmarked)}>{bookmarked?'★ 已收藏':'☆ 收藏'}</button><button onClick={()=>setReportOpen(x=>!x)}>⚑ 举报话题</button></div>{reportOpen&&<div className="report-box"><textarea aria-label="举报原因" rows={3} maxLength={500} placeholder="请描述举报原因（至少 6 字）" value={reportReason} onChange={e=>setReportReason(e.target.value)}/><button disabled={reportReason.trim().length<6} onClick={report}>提交举报</button></div>}<h3>讨论回复</h3>{replies.length?replies.map(r=><div className="reply" key={r.id}><b>{r.author}</b>{r.status!=='published'&&<small>等待审核</small>}<div className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{r.content}</ReactMarkdown></div></div>):<p className="member-note">还没有公开回复</p>}<label className="member-reply">参与讨论<textarea maxLength={3000} rows={4} value={content} onChange={e=>setContent(e.target.value)} placeholder={member?'写下你的想法，提交后进入审核':'登录后参与讨论'}/></label><TurnstileField revision={revision} onToken={setToken}/>{message&&<p className="member-note" role="status">{message}</p>}<button className="member-primary" disabled={busy||content.trim().length<2} onClick={reply}>提交回复</button></div>
}
export type {Member};
