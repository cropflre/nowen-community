import {Hono} from 'hono';
import {verifyTurnstile} from './turnstile';
import {createSession,denyCrossSite,getActor,oneLine,parseBody,passwordHash,randomId,rateLimit,requireActor,revokeSession,seconds,stringField,validRequestKey,verifyPassword,type CommunityBindings} from './security';
const app=new Hono<{Bindings:CommunityBindings}>();
app.use('*',async(c,next)=>{if(!['GET','HEAD','OPTIONS'].includes(c.req.method)&&denyCrossSite(c))return c.json({error:'ORIGIN_DENIED'},403);await next();});
app.get('/me',async c=>{const actor=await getActor(c);return c.json({user:actor});});
app.post('/auth/register',async c=>{
 if(!await rateLimit(c,'register',5))return c.json({error:'RATE_LIMITED'},429);
 const body=await parseBody(c,3000);if(!body)return c.json({error:'INVALID_BODY'},400);
 if(!await verifyTurnstile(c,body.turnstileToken))return c.json({error:'TURNSTILE_FAILED'},403);
 const username=stringField(body,'username',24)?.trim().toLowerCase()||'';
 const displayName=oneLine(stringField(body,'displayName',36)||'');
 const password=stringField(body,'password',128)||'';
 if(!/^[a-z0-9_]{3,24}$/.test(username)||displayName.length<2||displayName.length>32||password.length<6)return c.json({error:'INVALID_INPUT'},400);
 const pepper=c.env.PASSWORD_PEPPER;
 if(!pepper)return c.json({error:'AUTH_UNAVAILABLE'},503);
 let hash:string;
 try{hash=await passwordHash(password,pepper);}catch(error){
   console.error('registration_password_hash_failed',error instanceof Error?error.name:'unknown');
   return c.json({error:'AUTH_UNAVAILABLE'},503);
 }
 const id=randomId(),now=seconds();
 try {
  const result=await c.env.DB.prepare("INSERT INTO users(id,username,display_name,password_hash,role,state,created_at) VALUES(?,?,?,?,'member','active',?)")
   .bind(id,username,displayName,hash,now).run();
  if((result.meta.changes??0)!==1)return c.json({error:'REGISTRATION_FAILED'},409);
 await createSession(c,id);return c.json({user:{id,username,displayName,role:'member'}},201);
 }catch{return c.json({error:'REGISTRATION_FAILED'},409);}
});
app.post('/auth/login',async c=>{
 if(!await rateLimit(c,'login',10))return c.json({error:'RATE_LIMITED'},429);
 const body=await parseBody(c,1400);if(!body)return c.json({error:'INVALID_BODY'},400);
 if(!await verifyTurnstile(c,body.turnstileToken))return c.json({error:'TURNSTILE_FAILED'},403);
 const username=stringField(body,'username',24)?.trim().toLowerCase()||'';
 const password=stringField(body,'password',128)||'';
 if(!/^[a-z0-9_]{3,24}$/.test(username)||!password)return c.json({error:'INVALID_CREDENTIALS'},401);
 const user=await c.env.DB.prepare("SELECT id,username,display_name AS displayName,password_hash AS passwordHash,role FROM users WHERE username=? AND state='active'").bind(username).first<{id:string;username:string;displayName:string;passwordHash:string;role:string}>();
 if(!user)return c.json({error:'INVALID_CREDENTIALS'},401);
 const pepper=c.env.PASSWORD_PEPPER;
 if(!pepper)return c.json({error:'AUTH_UNAVAILABLE'},503);
 let valid=false;
 try{valid=await verifyPassword(password,user.passwordHash,pepper);}catch(error){
   console.error('login_password_verify_failed',error instanceof Error?error.name:'unknown');
   return c.json({error:'AUTH_UNAVAILABLE'},503);
 }
 if(!valid)return c.json({error:'INVALID_CREDENTIALS'},401);
 await createSession(c,user.id);return c.json({user:{id:user.id,username:user.username,displayName:user.displayName,role:user.role}});
});
app.post('/auth/logout',async c=>{await revokeSession(c);return c.json({ok:true});});
// A small account settings flow: no email recovery or insecure reset tokens.
app.post('/me/profile',async c=>{
 const user=await getActor(c);if(!user)return c.json({error:'UNAUTHORIZED'},401);
 const body=await parseBody(c,800);if(!body)return c.json({error:'INVALID_BODY'},400);
 const name=oneLine(stringField(body,'displayName',32)||'');
 if(name.length<2||name.length>32)return c.json({error:'INVALID_INPUT'},400);
 await c.env.DB.prepare('UPDATE users SET display_name=? WHERE id=?').bind(name,user.id).run();
 return c.json({user:{...user,displayName:name}});
});
app.post('/me/password',async c=>{
 const user=await getActor(c);if(!user)return c.json({error:'UNAUTHORIZED'},401);
 if(!await rateLimit(c,'change-password:'+user.id,5,3600))return c.json({error:'RATE_LIMITED'},429);
 const body=await parseBody(c,600);if(!body)return c.json({error:'INVALID_BODY'},400);
 const previous=stringField(body,'currentPassword',128),next=stringField(body,'newPassword',128);
 if(!previous||!next||next.length<6||next===previous)return c.json({error:'INVALID_INPUT'},400);
 const pepper=c.env.PASSWORD_PEPPER;if(!pepper)return c.json({error:'AUTH_UNAVAILABLE'},503);
 const row=await c.env.DB.prepare('SELECT password_hash AS passwordHash FROM users WHERE id=?').bind(user.id).first<{passwordHash:string}>();
 if(!row||!await verifyPassword(previous,row.passwordHash,pepper))return c.json({error:'INVALID_CREDENTIALS'},401);
 const replacement=await passwordHash(next,pepper);
 const changes=await c.env.DB.prepare('UPDATE users SET password_hash=? WHERE id=? AND password_hash=?').bind(replacement,user.id,row.passwordHash).run();
 if(!changes.meta.changes)return c.json({error:'CONFLICT'},409);
 await c.env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id).run();
 await createSession(c,user.id);
 return c.json({ok:true});
});
app.get('/me/topics',async c=>{const user=await getActor(c);if(!user)return c.json({error:'UNAUTHORIZED'},401);const {results}=await c.env.DB.prepare('SELECT id,slug,category_id AS categoryId,title,content,status,updated_at AS updatedAt FROM topics WHERE author_id=? ORDER BY updated_at DESC LIMIT 100').bind(user.id).all();return c.json({items:results});});
// Only the owner can delete an unpublished draft; no public content is affected.
app.delete('/me/topics/:id',async c=>{
 const user=await requireActor(c);if(!user)return c.json({error:'UNAUTHORIZED'},401);
 const r=await c.env.DB.prepare("DELETE FROM topics WHERE id=? AND author_id=? AND status='draft'").bind(c.req.param('id'),user.id).run();
 return r.meta.changes?c.json({ok:true}):c.json({error:'NOT_EDITABLE'},404);
});
app.post('/topics',async c=>{
 const user=await requireActor(c);if(!user)return c.json({error:'UNAUTHORIZED'},401);
 if(!await rateLimit(c,'topics:'+user.id,30,3600))return c.json({error:'RATE_LIMITED'},429);
 const key=c.req.header('Idempotency-Key')||null;if(!validRequestKey(key))return c.json({error:'IDEMPOTENCY_KEY_REQUIRED'},400);
 const body=await parseBody(c,16000);if(!body)return c.json({error:'INVALID_BODY'},400);
 const categoryId=stringField(body,'categoryId',80)||'';
 const category=await c.env.DB.prepare('SELECT id FROM categories WHERE id=?').bind(categoryId).first();if(!category)return c.json({error:'CATEGORY_NOT_FOUND'},400);
 const title=oneLine(stringField(body,'title',160)||''),content=stringField(body,'content',12000);if(content===null)return c.json({error:'INVALID_CONTENT'},400);
 const id=randomId(),slug=id,now=seconds();
 await c.env.DB.prepare("INSERT OR IGNORE INTO topics(id,slug,author_id,category_id,title,content,status,client_key,created_at,updated_at) VALUES(?,?,?,?,?,?,'draft',?,?,?)").bind(id,slug,user.id,categoryId,title,content,key,now,now).run();
 const item=await c.env.DB.prepare('SELECT id,slug,status FROM topics WHERE author_id=? AND client_key=?').bind(user.id,key).first();return item?c.json({item},201):c.json({error:'CREATE_FAILED'},409);
});
app.put('/topics/:id',async c=>{const user=await requireActor(c);if(!user)return c.json({error:'UNAUTHORIZED'},401);
 const body=await parseBody(c,16000);if(!body)return c.json({error:'INVALID_BODY'},400);const title=oneLine(stringField(body,'title',160)||''),content=stringField(body,'content',12000),categoryId=stringField(body,'categoryId',80)||'';if(content===null)return c.json({error:'INVALID_CONTENT'},400);
 const cat=await c.env.DB.prepare('SELECT id FROM categories WHERE id=?').bind(categoryId).first();if(!cat)return c.json({error:'CATEGORY_NOT_FOUND'},400);
 const r=await c.env.DB.prepare("UPDATE topics SET title=?,content=?,category_id=?,updated_at=? WHERE id=? AND author_id=? AND status='draft'").bind(title,content,categoryId,seconds(),c.req.param('id'),user.id).run();return r.meta.changes?c.json({ok:true}):c.json({error:'NOT_EDITABLE'},404);
});
app.post('/topics/:id/submit',async c=>{const user=await requireActor(c);if(!user)return c.json({error:'UNAUTHORIZED'},401);const body=await parseBody(c,2500);if(!await verifyTurnstile(c,body?.turnstileToken))return c.json({error:'TURNSTILE_FAILED'},403);const r=await c.env.DB.prepare("UPDATE topics SET status='pending',updated_at=? WHERE id=? AND author_id=? AND status='draft' AND length(trim(title)) BETWEEN 5 AND 160 AND length(trim(content)) BETWEEN 10 AND 12000").bind(seconds(),c.req.param('id'),user.id).run();return r.meta.changes?c.json({status:'pending'}):c.json({error:'NOT_SUBMITTABLE'},409);});
app.get('/topics/:slug/replies',async c=>{const slug=c.req.param('slug');const user=await getActor(c);const topic=await c.env.DB.prepare("SELECT id FROM topics WHERE slug=? AND status='published'").bind(slug).first<{id:string}>();if(!topic)return c.json({error:'NOT_FOUND'},404);const {results}=await c.env.DB.prepare("SELECT r.id,r.content,r.status,r.created_at AS createdAt,u.display_name AS author FROM replies r JOIN users u ON u.id=r.author_id WHERE r.topic_id=? AND (r.status='published' OR (r.status='pending' AND r.author_id=?)) ORDER BY r.created_at ASC LIMIT 100").bind(topic.id,user?.id??'').all();return c.json({items:results});});
app.post('/topics/:slug/replies',async c=>{const user=await requireActor(c);if(!user)return c.json({error:'UNAUTHORIZED'},401);if(!await rateLimit(c,'reply:'+user.id,60,3600))return c.json({error:'RATE_LIMITED'},429);
 const key=c.req.header('Idempotency-Key')||null;if(!validRequestKey(key))return c.json({error:'IDEMPOTENCY_KEY_REQUIRED'},400);const body=await parseBody(c,4200);if(!body)return c.json({error:'INVALID_BODY'},400);if(!await verifyTurnstile(c,body.turnstileToken))return c.json({error:'TURNSTILE_FAILED'},403);const content=stringField(body,'content',3000);if(!content||content.trim().length<2)return c.json({error:'INVALID_CONTENT'},400);
 const topic=await c.env.DB.prepare("SELECT id FROM topics WHERE slug=? AND status='published'").bind(c.req.param('slug')).first<{id:string}>();if(!topic)return c.json({error:'NOT_FOUND'},404);
 const now=seconds();await c.env.DB.prepare("INSERT OR IGNORE INTO replies(id,topic_id,author_id,content,status,client_key,created_at) VALUES(?,?,?,?,'pending',?,?)").bind(randomId(),topic.id,user.id,content,key,now).run();
 const item=await c.env.DB.prepare('SELECT id,status FROM replies WHERE author_id=? AND client_key=?').bind(user.id,key).first();return item?c.json({item},201):c.json({error:'CREATE_FAILED'},409);
});
// Bookmarked published topics only: private moderation states never leak into the personal list.
app.get('/me/bookmarks',async c=>{
 const user=await getActor(c);if(!user)return c.json({error:'UNAUTHORIZED'},401);
 const {results}=await c.env.DB.prepare("SELECT t.id,t.slug,t.title,SUBSTR(t.content,1,180) AS excerpt,t.reply_count AS replyCount,t.solved_at AS solvedAt,c.name AS categoryName,u.display_name AS authorName,t.created_at AS createdAt,b.created_at AS bookmarkedAt FROM bookmarks b JOIN topics t ON t.id=b.topic_id JOIN categories c ON c.id=t.category_id JOIN users u ON u.id=t.author_id WHERE b.user_id=? AND t.status='published' ORDER BY b.created_at DESC LIMIT 100").bind(user.id).all();
 return c.json({items:results});
});
// Best-answer lifecycle: the topic author owns it; admins/moderators may assist. Pending, hidden or foreign replies are never acceptable.
app.post('/topics/:id/best-answer',async c=>{
 const user=await requireActor(c);if(!user)return c.json({error:'UNAUTHORIZED'},401);
 if(!await rateLimit(c,'best-answer:'+user.id,30,3600))return c.json({error:'RATE_LIMITED'},429);
 const topic=await c.env.DB.prepare("SELECT id,author_id AS authorId,category_id AS categoryId,best_reply_id AS bestReplyId,solved_at AS solvedAt FROM topics WHERE id=? AND status='published'").bind(c.req.param('id')).first<{id:string;authorId:string;categoryId:string;bestReplyId:string|null;solvedAt:number|null}>();
 if(!topic)return c.json({error:'NOT_FOUND'},404);
 if(topic.categoryId!=='help')return c.json({error:'NOT_QUESTION_TOPIC'},409);
 const staff=['admin','moderator'].includes(user.role);
 if(topic.authorId!==user.id&&!staff)return c.json({error:'FORBIDDEN'},403);
 const body=await parseBody(c,400);if(!body)return c.json({error:'INVALID_BODY'},400);
 const replyId=stringField(body,'replyId',80);
 const now=seconds();
 const assisted=topic.authorId!==user.id; // staff helping on someone else's question
 if(replyId===null){
  const statements=[
   c.env.DB.prepare("UPDATE topics SET best_reply_id=NULL,solved_at=NULL,updated_at=? WHERE id=? AND best_reply_id IS NOT NULL").bind(now,topic.id),
  ];
  if(assisted)statements.push(
   c.env.DB.prepare("INSERT INTO audit_logs(id,actor_id,action,target_type,target_id,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1").bind(randomId(),user.id,'topic.unresolve','topic',topic.id,now)
  );
  const result=await c.env.DB.batch(statements);
  return (result[0].meta.changes??0)===1?c.json({item:{bestReplyId:null,solvedAt:null}}):c.json({error:'NOT_ALLOWED'},409);
 }
 const reply=await c.env.DB.prepare("SELECT id,author_id AS replyAuthorId FROM replies WHERE id=? AND topic_id=? AND status='published'").bind(replyId,topic.id).first<{id:string;replyAuthorId:string}>();
 if(!reply)return c.json({error:'REPLY_NOT_AVAILABLE'},404);
 if(reply.id===topic.bestReplyId)return c.json({item:{bestReplyId:reply.id,solvedAt:topic.solvedAt}}); // idempotent re-accept keeps stored solved_at
 const statements=[
  c.env.DB.prepare("UPDATE topics SET best_reply_id=?,solved_at=?,updated_at=? WHERE id=?").bind(reply.id,now,now,topic.id),
 ];
 if(assisted)statements.push(
  c.env.DB.prepare("INSERT INTO audit_logs(id,actor_id,action,target_type,target_id,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1").bind(randomId(),user.id,'topic.resolve','topic',topic.id,now)
 );
 if(reply.replyAuthorId!==user.id)statements.push(
  c.env.DB.prepare("INSERT OR IGNORE INTO notifications(id,user_id,kind,target_id,dedupe_key,created_at) VALUES(?,?, 'best_answer',?,?,?)").bind(randomId(),reply.replyAuthorId,topic.id,'best-answer:'+reply.id,now)
 );
 const result=await c.env.DB.batch(statements);
 if((result[0].meta.changes??0)!==1)return c.json({error:'CONFLICT'},409);
 return c.json({item:{bestReplyId:reply.id,solvedAt:now}});
});
for(const [suffix,table] of [['like','topic_likes'],['bookmark','bookmarks']] as const){
 app.post('/topics/:id/'+suffix,async c=>{const user=await requireActor(c);if(!user)return c.json({error:'UNAUTHORIZED'},401);const topic=await c.env.DB.prepare("SELECT id FROM topics WHERE id=? AND status='published'").bind(c.req.param('id')).first();if(!topic)return c.json({error:'NOT_FOUND'},404);await c.env.DB.prepare('INSERT OR IGNORE INTO '+table+'(topic_id,user_id,created_at) VALUES(?,?,?)').bind(c.req.param('id'),user.id,seconds()).run();return c.json({active:true});});
 app.delete('/topics/:id/'+suffix,async c=>{const user=await requireActor(c);if(!user)return c.json({error:'UNAUTHORIZED'},401);await c.env.DB.prepare('DELETE FROM '+table+' WHERE topic_id=? AND user_id=?').bind(c.req.param('id'),user.id).run();return c.json({active:false});});
}
export default app;
