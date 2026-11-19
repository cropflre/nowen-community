import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const base=process.env.SMOKE_BASE??'http://127.0.0.1:5173';
const origin=new URL(base).origin;
function sql(statement){return execFileSync('npx',['wrangler','d1','execute','nowen-community-db','--local','--command',statement],{encoding:'utf8',timeout:60000})}
async function req(path,method='GET',data,auth,extra={}){
 const response=await fetch(base+'/api/v1'+path,{method,headers:{Origin:origin,...(data===undefined?{}:{'Content-Type':'application/json'}),...(auth?{Cookie:auth}:{}),...extra},body:data===undefined?undefined:JSON.stringify(data)});
 return {status:response.status,data:await response.json().catch(()=>({})),cookie:response.headers.get('set-cookie')};
}
const unique=Date.now().toString(36);
// Local-only reset so repeated smoke runs do not collide with the shared register rate-limit bucket.
sql('DELETE FROM request_limits');
async function register(tag){
 const username='p0'+tag+unique.slice(-9);
 const registered=await req('/auth/register','POST',{username,displayName:tag+' member',password:'long strong test password for p0 batch one'});
 assert.equal(registered.status,201,JSON.stringify(registered.data));
 return {id:registered.data.user.id,username,cookie:registered.cookie.split(';')[0]};
}
const author=await register('author');
const helper=await register('helper');
const outsider=await register('outsider');
const staff=await register('staff');
sql("UPDATE users SET role='moderator' WHERE id='"+staff.id+"'");
// A published question in the help board.
const question=await req('/topics','POST',{categoryId:'help',title:'P0 question awaiting a best answer',content:'How do I sync my notes across devices safely?'},author.cookie,{'Idempotency-Key':'p0-question-create-000000001'});
assert.equal(question.status,201,JSON.stringify(question.data));
const topicId=question.data.item.id;
await req('/topics/'+topicId+'/submit','POST',undefined,author.cookie);
sql("UPDATE topics SET status='published' WHERE id='"+topicId+"'");
// A discussion topic in another board must not accept answers.
const chat=await req('/topics','POST',{categoryId:'chat',title:'P0 casual discussion not a question',content:'This topic lives in the chat board and must stay a plain discussion.'},author.cookie,{'Idempotency-Key':'p0-chat-create-000000000001'});
await req('/topics/'+chat.data.item.id+'/submit','POST',undefined,author.cookie);
sql("UPDATE topics SET status='published' WHERE id='"+chat.data.item.id+"'");
// Two replies: one pending, one published.
const pending=await req('/topics/'+question.data.item.slug+'/replies','POST',{content:'Pending reply that must never be accepted.'},helper.cookie,{'Idempotency-Key':'p0-reply-pending-000000001'});
assert.equal(pending.status,201);
const good=await req('/topics/'+question.data.item.slug+'/replies','POST',{content:'Published reply that solves the problem.'},helper.cookie,{'Idempotency-Key':'p0-reply-published-00001'});
assert.equal(good.status,201);
sql("UPDATE replies SET status='published' WHERE id='"+good.data.item.id+"'");
// Acceptance rules.
const guest=await req('/topics/'+topicId+'/best-answer','POST',{replyId:good.data.item.id});
assert.equal(guest.status,401,'Guests cannot accept answers');
const notAuthor=await req('/topics/'+topicId+'/best-answer','POST',{replyId:good.data.item.id},outsider.cookie);
assert.equal(notAuthor.status,403,'Only the topic author or staff can accept answers');
const wrongBoard=await req('/topics/'+chat.data.item.id+'/best-answer','POST',{replyId:good.data.item.id},author.cookie);
assert.equal(wrongBoard.status,409,'Discussion topics cannot accept answers');
const notPublished=await req('/topics/'+topicId+'/best-answer','POST',{replyId:pending.data.item.id},author.cookie);
assert.equal(notPublished.status,404,'Pending replies cannot be accepted');
const foreign=await req('/topics/'+topicId+'/best-answer','POST',{replyId:'nonexistent-reply-id'},author.cookie);
assert.equal(foreign.status,404,'Missing replies cannot be accepted');
// Author accepts, staff can also assist, and the state is observable.
const accept=await req('/topics/'+topicId+'/best-answer','POST',{replyId:good.data.item.id},author.cookie);
assert.equal(accept.status,200,JSON.stringify(accept.data));
assert.equal(accept.data.item.bestReplyId,good.data.item.id);
assert.ok(accept.data.item.solvedAt>0);
const reaccept=await req('/topics/'+topicId+'/best-answer','POST',{replyId:good.data.item.id},author.cookie);
assert.equal(reaccept.status,200,'Re-accepting the same reply is idempotent');
const detail=await req('/topics/'+question.data.item.slug);
assert.equal(detail.status,200);
assert.equal(detail.data.item.bestReplyId,good.data.item.id,'Detail API exposes the best answer');
assert.ok(detail.data.item.solvedAt>0,'Detail API exposes the solved state');
assert.equal(detail.data.item.authorId,author.id,'Detail API exposes the topic author for permission checks');
assert.equal(detail.data.item.viewer,null,'Guest viewers get no engagement state');
// Feed resolution filters.
const solvedFeed=await req('/topics?resolution=solved');
assert.ok(solvedFeed.data.items.some(t=>t.id===topicId),'Solved filter includes the resolved question');
const unsolvedFeed=await req('/topics?resolution=unsolved');
assert.ok(!unsolvedFeed.data.items.some(t=>t.id===topicId),'Solved question leaves the unsolved filter');
assert.ok(!unsolvedFeed.data.items.some(t=>t.id===chat.data.item.id),'Non-help topics never count as unsolved problems');
const searchSolved=await req('/topics?resolution=solved&q='+encodeURIComponent('best answer'));
assert.ok(searchSolved.data.items.some(t=>t.id===topicId),'Search supports the solved filter');
// The accepted reply author is notified.
const notices=await req('/notifications','GET',undefined,helper.cookie);
const bestNotice=notices.data.items.find(n=>n.kind==='best_answer'&&n.targetId===topicId);
assert.ok(bestNotice,'Reply author receives a best_answer notification');
assert.ok(!bestNotice.readAt);
// Staff may reopen and re-accept on someone else's question; both actions are audited.
const reopen=await req('/topics/'+topicId+'/best-answer','POST',{replyId:null},staff.cookie);
assert.equal(reopen.status,200,'Moderators can reopen a question');
assert.equal(reopen.data.item.bestReplyId,null);
const afterReopen=await req('/topics?resolution=unsolved');
assert.ok(afterReopen.data.items.some(t=>t.id===topicId),'Reopened question returns to the unsolved filter');
const staffAccept=await req('/topics/'+topicId+'/best-answer','POST',{replyId:good.data.item.id},staff.cookie);
assert.equal(staffAccept.status,200,'Moderators can accept on behalf of the author');
const audit=sql("SELECT action FROM audit_logs WHERE target_type='topic' AND target_id='"+topicId+"' ORDER BY created_at");
assert.match(audit,/topic\.resolve/,'Staff resolution is audited');
assert.match(audit,/topic\.unresolve/,'Staff reopening is audited');
// Engagement state survives a reload: viewer flags come from the server.
const like=await req('/topics/'+topicId+'/like','POST',undefined,author.cookie);
assert.equal(like.status,200);
const bookmark=await req('/topics/'+topicId+'/bookmark','POST',undefined,author.cookie);
assert.equal(bookmark.status,200);
const asAuthor=await req('/topics/'+question.data.item.slug,'GET',undefined,author.cookie);
assert.deepEqual(asAuthor.data.item.viewer,{liked:true,bookmarked:true},'Reloaded detail restores the member engagement state');
const asHelper=await req('/topics/'+question.data.item.slug,'GET',undefined,helper.cookie);
assert.deepEqual(asHelper.data.item.viewer,{liked:false,bookmarked:false},'Other members keep their own state');
// Personal bookmark list only shows published topics and supports unbookmarking.
const chatDraft=await req('/topics','POST',{categoryId:'chat',title:'P0 hidden bookmark victim',content:'This topic will be hidden while bookmarked.'},helper.cookie,{'Idempotency-Key':'p0-hidden-bookmark-000001'});
await req('/topics/'+chatDraft.data.item.id+'/submit','POST',undefined,helper.cookie);
sql("UPDATE topics SET status='published' WHERE id='"+chatDraft.data.item.id+"'");
await req('/topics/'+chatDraft.data.item.id+'/bookmark','POST',undefined,helper.cookie);
sql("UPDATE topics SET status='hidden' WHERE id='"+chatDraft.data.item.id+"'");
const bookmarks=await req('/me/bookmarks','GET',undefined,author.cookie);
assert.equal(bookmarks.status,200);
assert.ok(bookmarks.data.items.some(t=>t.id===topicId),'Bookmarks list includes the saved topic');
assert.ok(!bookmarks.data.items.some(t=>t.id===chatDraft.data.item.id),'Hidden topics disappear from bookmarks');
const bookmarksGuest=await req('/me/bookmarks');
assert.equal(bookmarksGuest.status,401);
const unbookmark=await req('/topics/'+topicId+'/bookmark','DELETE',undefined,author.cookie);
assert.equal(unbookmark.status,200);
const afterRemove=await req('/me/bookmarks','GET',undefined,author.cookie);
assert.ok(!afterRemove.data.items.some(t=>t.id===topicId),'Unbookmarked topics leave the personal list');
console.log('P0 batch 1 live integration passed: engagement state, bookmarks list, best answers, resolution filters, notifications, audit');
