import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Topic UI renders Markdown securely and has a source editing toolbar',()=>{
 const page=read('src/client/main.tsx'),editor=read('src/client/member.tsx');
 assert.match(page,/ReactMarkdown remarkPlugins=\{\[remarkGfm\]\}/);
 assert.match(editor,/editor-toolbar/);assert.match(editor,/图片已插入正文/);
 assert.match(editor,/queue\.current/);assert.match(editor,/serverId\.current/);
 assert.doesNotMatch(page,/dangerouslySetInnerHTML/);
});
test('Member content management and moderator actions require owner or reviewer',()=>{
 const ui=read('src/client/member.tsx'),users=read('src/worker/members.ts'),admin=read('src/worker/moderation.ts');
 assert.match(ui,/MyTopicsDialog/);assert.match(users,/\/me\/topics\/:id/);
 assert.match(users,/author_id=\? AND status='draft'/);
 for(const word of ["/admin/users","/admin/topics","/admin/topics/:id/manage","'user.unsuspend'","'topic.'+action","targetPreview"]){
  assert.ok(admin.includes(word),'Missing moderation action '+word);
 }
 assert.match(admin,/denyCrossSite/);
});
