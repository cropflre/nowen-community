import { Hono } from 'hono';
import { getActor,parseBody,rateLimit,randomId,seconds,stringField,type CommunityBindings } from './security';
import { verifyTurnstile,turnstileRequired } from './turnstile';

const mod=new Hono<{Bindings:CommunityBindings}>();
const admin=async(c:any)=>{const user=await getActor(c);return user&&['admin','moderator'].includes(user.role)?user:null;};
const owner=async(c:any)=>{const user=await getActor(c);return user?.role==='admin'?user:null;};
const typeOf=(value:unknown)=>value==='topic'||value==='reply'?value:null;

mod.get('/security/turnstile',c=>c.json({required:turnstileRequired(c),siteKey:c.env.TURNSTILE_SITE_KEY??null}));

mod.post('/reports',async c=>{
 const user=await getActor(c);if(!user)return c.json({error:'UNAUTHORIZED'},401);
 if(!await rateLimit(c,'reports:'+user.id,10,3600))return c.json({error:'RATE_LIMITED'},429);
 const b=await parseBody(c,2200);if(!b)return c.json({error:'INVALID_BODY'},400);
 const type=typeOf(b.type),target=stringField(b,'targetId',80),reason=stringField(b,'reason',500)?.trim();
 if(!type||!target||!reason||reason.length<6)return c.json({error:'INVALID_INPUT'},400);
 const table=type==='topic'?'topics':'replies';
 const item=await c.env.DB.prepare("SELECT id FROM "+table+" WHERE id=? AND status='published'").bind(target).first();
 if(!item)return c.json({error:'NOT_FOUND'},404);
 const id=randomId();
 await c.env.DB.prepare("INSERT INTO reports(id,reporter_id,target_type,target_id,reason,status,created_at) VALUES(?,?,?,?,?,'open',?)").bind(id,user.id,type,target,reason,seconds()).run();
 return c.json({id,status:'open'},201);
});

mod.get('/admin/overview',async c=>{
 const user=await admin(c);if(!user)return c.json({error:'FORBIDDEN'},403);
 const [topics,replies,reports,uploads]=await c.env.DB.batch([
   c.env.DB.prepare("SELECT count(*) AS count FROM topics WHERE status='pending'"),
   c.env.DB.prepare("SELECT count(*) AS count FROM replies WHERE status='pending'"),
   c.env.DB.prepare("SELECT count(*) AS count FROM reports WHERE status='open'"),
   c.env.DB.prepare("SELECT count(*) AS count FROM uploads WHERE state='pending'")
 ]);
 return c.json({counts:{topics:(topics.results[0] as any)?.count??0,replies:(replies.results[0] as any)?.count??0,reports:(reports.results[0] as any)?.count??0,uploads:(uploads.results[0] as any)?.count??0}});
});
mod.get('/admin/queue',async c=>{
 const user=await admin(c);if(!user)return c.json({error:'FORBIDDEN'},403);
 const type=c.req.query('type')==='reply'?'reply':'topic';
 const statement=type==='topic'
  ? "SELECT t.id,t.title,t.content,t.status,t.created_at AS createdAt,u.username AS author FROM topics t JOIN users u ON t.author_id=u.id WHERE t.status='pending' ORDER BY t.created_at ASC LIMIT 60"
  : "SELECT r.id,r.content,r.status,r.created_at AS createdAt,u.username AS author,t.title AS topicTitle FROM replies r JOIN users u ON r.author_id=u.id JOIN topics t ON t.id=r.topic_id WHERE r.status='pending' ORDER BY r.created_at ASC LIMIT 60";
 const {results}=await c.env.DB.prepare(statement).all();
 return c.json({items:results});
});
mod.post('/admin/review',async c=>{
 const user=await admin(c);if(!user)return c.json({error:'FORBIDDEN'},403);
 const b=await parseBody(c,700);if(!b)return c.json({error:'INVALID_BODY'},400);
 const type=typeOf(b.type),id=stringField(b,'id',80),action=b.action;
 if(!type||!id||(action!=='approve'&&action!=='reject'))return c.json({error:'INVALID_INPUT'},400);
 const table=type==='topic'?'topics':'replies';
 const targetStatus=action==='approve'?'published':'hidden';
 const auditId=randomId();
 // D1 batch is transactional: updating state and audit trail commit together.
 const statements=[
  c.env.DB.prepare("UPDATE "+table+" SET status=? WHERE id=? AND status='pending'").bind(targetStatus,id),
  c.env.DB.prepare("INSERT INTO audit_logs(id,actor_id,action,target_type,target_id,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1").bind(auditId,user.id,'moderation.'+action,type,id,seconds())
 ];
 if(action==='approve'&&type==='topic')statements.push(
  c.env.DB.prepare("INSERT OR IGNORE INTO notifications(id,user_id,kind,target_id,dedupe_key,created_at) SELECT ?,author_id,'topic_published',id,?,? FROM topics WHERE id=? AND status='published'").bind(randomId(),'topic:'+id,seconds(),id)
 );
 if(action==='approve'&&type==='reply')statements.push(
  c.env.DB.prepare("INSERT OR IGNORE INTO notifications(id,user_id,kind,target_id,dedupe_key,created_at) SELECT ?,t.author_id,'reply_approved',t.id,?,? FROM replies r JOIN topics t ON t.id=r.topic_id WHERE r.id=? AND r.status='published' AND r.author_id!=t.author_id").bind(randomId(),'reply:'+id,seconds(),id)
 );
 const result=await c.env.DB.batch(statements);
 if((result[0].meta.changes??0)!==1)return c.json({error:'NOT_PENDING'},409);
 if(type==='reply'&&action==='approve'){
  await c.env.DB.prepare("UPDATE topics SET reply_count=(SELECT count(*) FROM replies WHERE topic_id=topics.id AND status='published') WHERE id=(SELECT topic_id FROM replies WHERE id=?)").bind(id).run();
 }
 return c.json({ok:true,status:targetStatus});
});
mod.get('/admin/reports',async c=>{
 const user=await admin(c);if(!user)return c.json({error:'FORBIDDEN'},403);
 const {results}=await c.env.DB.prepare("SELECT r.id,r.reason,r.target_type AS type,r.target_id AS targetId,r.created_at AS createdAt,u.username AS reporter FROM reports r JOIN users u ON r.reporter_id=u.id WHERE r.status='open' ORDER BY r.created_at ASC LIMIT 60").all();
 return c.json({items:results});
});
mod.post('/admin/reports/:id/resolve',async c=>{
 const user=await admin(c);if(!user)return c.json({error:'FORBIDDEN'},403);
 const b=await parseBody(c,350);if(!b)return c.json({error:'INVALID_BODY'},400);
 if(b.outcome!=='resolved'&&b.outcome!=='dismissed')return c.json({error:'INVALID_INPUT'},400);
 const id=c.req.param('id');
 const result=await c.env.DB.batch([
  c.env.DB.prepare("UPDATE reports SET status=? WHERE id=? AND status='open'").bind(b.outcome,id),
  c.env.DB.prepare("INSERT INTO audit_logs(id,actor_id,action,target_type,target_id,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1").bind(randomId(),user.id,'report.'+b.outcome,'report',id,seconds())
 ]);
 return (result[0].meta.changes??0)===1?c.json({ok:true}):c.json({error:'NOT_OPEN'},409);
});
mod.post('/admin/users/:id/suspend',async c=>{
 const user=await owner(c);if(!user)return c.json({error:'FORBIDDEN'},403);
 const id=c.req.param('id');if(id===user.id)return c.json({error:'SELF_ACTION_DENIED'},403);
 const result=await c.env.DB.batch([
   c.env.DB.prepare("UPDATE users SET state='suspended' WHERE id=? AND role='member' AND state='active'").bind(id),
   c.env.DB.prepare("INSERT INTO audit_logs(id,actor_id,action,target_type,target_id,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1").bind(randomId(),user.id,'user.suspend','user',id,seconds()),
   c.env.DB.prepare("DELETE FROM sessions WHERE user_id=? AND EXISTS(SELECT 1 FROM users WHERE id=? AND state='suspended')").bind(id,id)
 ]);
 return (result[0].meta.changes??0)===1?c.json({ok:true}):c.json({error:'NOT_ALLOWED'},409);
});

// Private R2. Never accept SVG/HTML, never expose the bucket on r2.dev.
const mimeTypes:{[key:string]:string}={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'};
function detectMime(bytes:Uint8Array):string|null{
 if(bytes.length>=8&&bytes.slice(0,8).every((v,i)=>v===[137,80,78,71,13,10,26,10][i]))return 'image/png';
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'image/webp';
 return null;
}
mod.post('/uploads',async c=>{
 const user=await getActor(c);if(!user)return c.json({error:'UNAUTHORIZED'},401);
 if(!await rateLimit(c,'uploads:'+user.id,12,3600))return c.json({error:'RATE_LIMITED'},429);
 const token=c.req.header('X-Turnstile-Token');
 if(!await verifyTurnstile(c,token))return c.json({error:'TURNSTILE_FAILED'},403);
 const maxSize=2*1024*1024;
 const header=c.req.header('Content-Length'),length=header===undefined?null:Number(header);
 if(length!==null&&(!Number.isInteger(length)||length<=0||length>maxSize))return c.json({error:'FILE_TOO_LARGE'},413);
 const declared=c.req.header('Content-Type')?.toLowerCase()||'';
 if(!(declared in mimeTypes))return c.json({error:'UNSUPPORTED_MEDIA'},415);
 // Handle chunked/browser requests without Content-Length, stopping at the cap before buffering.
 const reader=c.req.raw.body?.getReader();
 if(!reader)return c.json({error:'EMPTY_FILE'},400);
 const chunks:Uint8Array[]=[];let total=0;
 while(true){const part=await reader.read();if(part.done)break;total+=part.value.byteLength;if(total>maxSize){await reader.cancel();return c.json({error:'FILE_TOO_LARGE'},413);}chunks.push(part.value);}
 const bytes=new Uint8Array(total);let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 if(!total||(length!==null&&total!==length)||detectMime(bytes)!==declared)return c.json({error:'INVALID_FILE_SIGNATURE'},415);
 if(!c.env.MEDIA)return c.json({error:'STORAGE_UNAVAILABLE'},503);
 const id=randomId(),key='pending/'+user.id+'/'+id+'.'+mimeTypes[declared];
 await c.env.MEDIA.put(key,bytes,{httpMetadata:{contentType:declared,cacheControl:'private, no-store'}});
 try{
  await c.env.DB.prepare("INSERT INTO uploads(id,user_id,object_key,content_type,size_bytes,state,created_at) VALUES(?,?,?,?,?,'pending',?)").bind(id,user.id,key,declared,bytes.byteLength,seconds()).run();
 }catch{await c.env.MEDIA.delete(key);return c.json({error:'UPLOAD_FAILED'},500);}
 return c.json({id,state:'pending'},201);
});
mod.get('/media/:id',async c=>{
 const user=await getActor(c);
 const row=await c.env.DB.prepare('SELECT user_id AS userId,object_key AS objectKey,content_type AS contentType,state FROM uploads WHERE id=?').bind(c.req.param('id')).first<{userId:string;objectKey:string;contentType:string;state:string}>();
 if(!row||row.state==='deleted')return c.json({error:'NOT_FOUND'},404);
 if(row.state!=='approved'&&(!user||(user.id!==row.userId&&user.role==='member')))return c.json({error:'NOT_FOUND'},404);
 if(!c.env.MEDIA)return c.json({error:'STORAGE_UNAVAILABLE'},503);
 const object=await c.env.MEDIA.get(row.objectKey);
 if(!object)return c.json({error:'NOT_FOUND'},404);
 return new Response(object.body,{headers:{'Content-Type':row.contentType,'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store','Content-Security-Policy':"default-src 'none'; sandbox",'Content-Disposition':row.state==='approved'?'inline':'attachment'}});
});
mod.get('/admin/uploads',async c=>{
 const user=await admin(c);if(!user)return c.json({error:'FORBIDDEN'},403);
 const {results}=await c.env.DB.prepare("SELECT a.id,a.content_type AS contentType,a.size_bytes AS sizeBytes,a.created_at AS createdAt,u.username AS author FROM uploads a JOIN users u ON u.id=a.user_id WHERE a.state='pending' ORDER BY a.created_at ASC LIMIT 60").all();
 return c.json({items:results});
});
mod.post('/admin/uploads/:id/review',async c=>{
 const user=await admin(c);if(!user)return c.json({error:'FORBIDDEN'},403);
 const b=await parseBody(c,250);if(!b||(b.action!=='approve'&&b.action!=='reject'))return c.json({error:'INVALID_INPUT'},400);
 const newStatus=b.action==='approve'?'approved':'deleted';
 const result=await c.env.DB.batch([
  c.env.DB.prepare("UPDATE uploads SET state=? WHERE id=? AND state='pending'").bind(newStatus,c.req.param('id')),
  c.env.DB.prepare("INSERT INTO audit_logs(id,actor_id,action,target_type,target_id,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1").bind(randomId(),user.id,'upload.'+b.action,'upload',c.req.param('id'),seconds())
 ]);
 return (result[0].meta.changes??0)===1?c.json({ok:true,state:newStatus}):c.json({error:'NOT_PENDING'},409);
});
export default mod;
