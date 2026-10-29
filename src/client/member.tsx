import React,{useEffect,useState} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
type Member={id:string;username:string;displayName:string;role:string};
type Category={id:string;name:string};
const request=async <T,>(path:string,method='GET',body?:unknown,requestKey?:string):Promise<T>=>{
 const headers:Record<string,string>={Accept:'application/json'};
 if(body!==undefined)headers['Content-Type']='application/json';
 if(requestKey)headers['Idempotency-Key']=requestKey;
 const response=await fetch(path,{method,headers,credentials:'same-origin',body:body===undefined?undefined:JSON.stringify(body)});
 const value=await response.json().catch(()=>({error:'NETWORK_ERROR'})) as Record<string,unknown>;
 if(!response.ok)throw new Error(value.error||('HTTP '+response.status));return value as T;
};
export function useMember(){const [member,setMember]=useState<Member|null>(null);const [loading,setLoading]=useState(true);useEffect(()=>{let live=true;request<{user:Member|null}>('/api/v1/me').then(d=>{if(live)setMember(d.user)}).catch(()=>{}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[]);return {member,setMember,loading};}
export function AuthDialog({onClose,onAuthenticated}:{onClose:()=>void;onAuthenticated:(member:Member)=>void}){
 const [mode,setMode]=useState<'login'|'register'>('login');
 const [username,setUsername]=useState(''),[displayName,setDisplayName]=useState(''),[password,setPassword]=useState(''),[invitation,setInvitation]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(event:React.FormEvent){event.preventDefault();setBusy(true);setError('');try{const result=await request<{user:Member}>('/api/v1/auth/'+(mode==='login'?'login':'register'),'POST',mode==='login'?{username,password}:{username,displayName,password,invitation});onAuthenticated(result.user);onClose();}catch(e){setError(e instanceof Error?e.message:'请求失败')}finally{setBusy(false)}}
 return <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section role="dialog" aria-modal="true" aria-labelledby="auth-title" className="member-dialog"><button className="member-close" onClick={onClose} aria-label="关闭">×</button><h2 id="auth-title">{mode==='login'?'欢迎回到弄文社区':'邀请制加入社区'}</h2><p>为了保持友善的讨论环境，目前仅接受邀请码注册。</p><div className="auth-switch"><button className={mode==='login'?'active':''} onClick={()=>{setMode('login');setError('')}}>登录</button><button className={mode==='register'?'active':''} onClick={()=>{setMode('register');setError('')}}>邀请码注册</button></div><form onSubmit={submit}>
 <label>用户名<input required autoComplete="username" maxLength={24} minLength={3} value={username} onChange={e=>setUsername(e.target.value)} placeholder="英文字母、数字或下划线"/></label>
 {mode==='register'&&<label>昵称<input required maxLength={32} minLength={2} value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="在社区展示的名称"/></label>}
 <label>密码<input required type="password" autoComplete={mode==='login'?'current-password':'new-password'} minLength={mode==='login'?1:12} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode==='login'?'输入密码':'至少 12 位密码'}/></label>
 {mode==='register'&&<label>邀请码<input required maxLength={100} value={invitation} onChange={e=>setInvitation(e.target.value)} placeholder="管理员提供的一次性邀请码"/></label>}
 {error&&<p className="member-error" role="alert">{error}</p>}<button className="member-primary" disabled={busy} type="submit">{busy?'正在处理…':mode==='login'?'登录社区':'创建账号'}</button>
 </form></section></div>
}
const draftKey=(id:string)=>'nowen-community-draft:'+id;
export function ComposerDialog({member,categories,onClose}:{member:Member;categories:Category[];onClose:()=>void}){
 const stored=(()=>{try{const v=localStorage.getItem(draftKey(member.id));return v?JSON.parse(v) as {id?:string;key?:string;title?:string;content?:string;categoryId?:string}:null}catch{return null}})();
 const [title,setTitle]=useState(stored?.title||''),[content,setContent]=useState(stored?.content||''),[categoryId,setCategoryId]=useState(stored?.categoryId||categories[0]?.id||''),[id,setId]=useState(stored?.id||'');
 const [key]=useState(stored?.key||crypto.randomUUID()),[saving,setSaving]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[preview,setPreview]=useState(false);
 useEffect(()=>{localStorage.setItem(draftKey(member.id),JSON.stringify({id,key,title,content,categoryId}))},[member.id,id,key,title,content,categoryId]);
 async function persist(){if(!categoryId)return '';setSaving(true);try{if(!id){const result=await request<{item:{id:string}}>('/api/v1/topics','POST',{title,content,categoryId},key);setId(result.item.id);return result.item.id;}await request('/api/v1/topics/'+encodeURIComponent(id),'PUT',{title,content,categoryId});return id;}finally{setSaving(false)}}
 useEffect(()=>{if(!categoryId)return;const timer=setTimeout(()=>{persist().then(()=>setMessage('草稿已保存')).catch(()=>setMessage('自动保存失败，请检查网络'))},900);return()=>clearTimeout(timer);},[title,content,categoryId,id]);
 async function submit(){if(title.trim().length<5||content.trim().length<10){setMessage('标题至少 5 字，正文至少 10 字');return;}setBusy(true);try{const current=await persist();if(!current)return;await request('/api/v1/topics/'+encodeURIComponent(current),'PUT',{title,content,categoryId});await request('/api/v1/topics/'+encodeURIComponent(current)+'/submit','POST');localStorage.removeItem(draftKey(member.id));setMessage('已提交审核，审核通过后其他用户才能看到');setTimeout(onClose,1300);}catch(e){setMessage(e instanceof Error?e.message:'提交失败')}finally{setBusy(false)}}
 return <div className="modal-backdrop" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="compose-title" className="member-dialog composer"><button className="member-close" onClick={onClose} aria-label="关闭">×</button><h2 id="compose-title">发布新话题</h2><p>支持 Markdown，草稿自动保存；提交后先进入审核。</p><label>社区板块<select value={categoryId} onChange={e=>setCategoryId(e.target.value)}>{categories.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>标题<input maxLength={160} value={title} onChange={e=>setTitle(e.target.value)} placeholder="用一句话描述你想讨论的事情"/></label><label>正文<textarea rows={9} maxLength={12000} value={content} onChange={e=>setContent(e.target.value)} placeholder="分享你的想法，支持 Markdown 语法…"/></label><div className="compose-preview"><button onClick={()=>setPreview(!preview)}>{preview?'返回编辑':'预览 Markdown'}</button>{preview&&<div className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown></div>}</div><div className="composer-bottom"><small role="status">{saving?'保存中…':message||'草稿将在停止输入后自动保存'}</small><button className="member-primary" onClick={submit} disabled={busy||saving}>{busy?'提交中…':'提交审核'}</button></div></section></div>
}
export function TopicEngagement({id,slug,member,onLogin}:{id:string;slug:string;member:Member|null;onLogin:()=>void}){
 const [replies,setReplies]=useState<{id:string;content:string;status:string;author:string;createdAt:number}[]>([]);
 const [content,setContent]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const [liked,setLiked]=useState(false),[bookmarked,setBookmarked]=useState(false);
 useEffect(()=>{request<{items:typeof replies}>('/api/v1/topics/'+encodeURIComponent(slug)+'/replies').then(d=>setReplies(d.items)).catch(()=>{})},[slug,member?.id]);
 async function reply(){if(!member){onLogin();return;}setBusy(true);try{const result=await request<{item:{status:string}}>('/api/v1/topics/'+encodeURIComponent(slug)+'/replies','POST',{content},crypto.randomUUID());setContent('');setMessage('回复已提交审核');const d=await request<{items:typeof replies}>('/api/v1/topics/'+encodeURIComponent(slug)+'/replies');setReplies(d.items)}catch(e){setMessage(e instanceof Error?e.message:'发送失败')}finally{setBusy(false)}}
 async function reaction(type:'like'|'bookmark',active:boolean){if(!member){onLogin();return;}try{await request('/api/v1/topics/'+encodeURIComponent(id)+'/'+type,active?'DELETE':'POST');type==='like'?setLiked(!active):setBookmarked(!active);}catch(e){setMessage(e instanceof Error?e.message:'操作失败')}}
 return <div className="engagement"><div className="engagement-actions"><button onClick={()=>reaction('like',liked)}>{liked?'♥ 已点赞':'♡ 点赞'}</button><button onClick={()=>reaction('bookmark',bookmarked)}>{bookmarked?'★ 已收藏':'☆ 收藏'}</button></div><h3>讨论回复</h3>{replies.length?replies.map(r=><div className="reply" key={r.id}><b>{r.author}</b>{r.status!=='published'&&<small>等待审核</small>}<div className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{r.content}</ReactMarkdown></div></div>):<p className="member-note">还没有公开回复</p>}<label className="member-reply">参与讨论<textarea maxLength={3000} rows={4} value={content} onChange={e=>setContent(e.target.value)} placeholder={member?'写下你的想法，提交后进入审核':'登录后参与讨论'}/></label>{message&&<p className="member-note" role="status">{message}</p>}<button className="member-primary" disabled={busy||content.trim().length<2} onClick={reply}>提交回复</button></div>
}
export type {Member};
