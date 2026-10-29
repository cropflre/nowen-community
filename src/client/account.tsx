import React,{useState} from 'react';
import {friendlyError} from './errors';
type Member={id:string;username:string;displayName:string;role:string};
async function api<T>(path:string,payload:unknown):Promise<T>{
 const r=await fetch('/api/v1'+path,{method:'POST',credentials:'same-origin',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify(payload)});
 const data=await r.json().catch(()=>({error:'NETWORK_ERROR'})) as {error?:string};
 if(!r.ok)throw new Error(friendlyError(data.error||'HTTP '+r.status));
 return data as T;
}
export function AccountDialog({member,onClose,onUpdated,onLogout}:{member:Member;onClose:()=>void;onUpdated:(member:Member)=>void;onLogout:()=>void}){
 const [name,setName]=useState(member.displayName),[current,setCurrent]=useState(''),[next,setNext]=useState(''),[confirm,setConfirm]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function saveName(event:React.FormEvent){
  event.preventDefault();if(name.trim().length<2)return;
  setBusy(true);setError('');setNotice('');
  try{const result=await api<{user:Member}>('/me/profile',{displayName:name.trim()});onUpdated(result.user);setNotice('昵称已更新');}
  catch(e){setError(e instanceof Error?e.message:'保存失败')}finally{setBusy(false)}
 }
 async function savePassword(event:React.FormEvent){
  event.preventDefault();setError('');setNotice('');
  if(next.length<12){setError('新密码至少需要 12 位');return}
  if(next!==confirm){setError('两次输入的新密码不一致');return}
  setBusy(true);
  try{await api('/me/password',{currentPassword:current,newPassword:next});setCurrent('');setNext('');setConfirm('');setNotice('密码修改成功，其他设备已退出登录');}
  catch(e){setError(e instanceof Error?e.message:'修改失败')}finally{setBusy(false)}
 }
 return <div className="modal-backdrop" role="presentation"><section className="member-dialog account-dialog" role="dialog" aria-modal="true" aria-labelledby="account-title">
  <button className="member-close" onClick={onClose} aria-label="关闭">×</button><h2 id="account-title">账号设置</h2><p>用户名 {member.username} · 管理你的资料和密码</p>
  {notice&&<p className="account-success" role="status">{notice}</p>}{error&&<p className="member-error" role="alert">{error}</p>}
  <form onSubmit={saveName}><h3>公开资料</h3><label>社区昵称<input required minLength={2} maxLength={32} value={name} onChange={e=>setName(e.target.value)}/></label><button className="member-primary" type="submit" disabled={busy}>保存昵称</button></form>
  <form onSubmit={savePassword}><h3>修改密码</h3><label>当前密码<input type="password" required autoComplete="current-password" value={current} onChange={e=>setCurrent(e.target.value)}/></label><label>新密码（至少 12 位）<input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={next} onChange={e=>setNext(e.target.value)}/></label><label>确认新密码<input type="password" required autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)}/></label><button className="member-primary" type="submit" disabled={busy}>修改密码</button></form>
  <button className="account-logout" onClick={onLogout}>退出登录</button>
 </section></div>;
}
