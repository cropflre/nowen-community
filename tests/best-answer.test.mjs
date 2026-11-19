import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('best answers are additive in D1 and widen notification kinds safely',()=>{
 const migration=read('migrations/0005_best_answers.sql'),schema=read('src/db/schema.ts');
 assert.match(migration,/ALTER TABLE topics ADD COLUMN best_reply_id/);
 assert.match(migration,/ALTER TABLE topics ADD COLUMN solved_at/);
 assert.match(migration,/topics_solved_idx/);
 assert.match(migration,/INSERT INTO notifications_wide SELECT/,'Existing notifications must be preserved');
 assert.match(migration,/DROP TABLE notifications/);
 assert.match(migration,/kind IN \('topic_published','reply_approved','best_answer'\)/);
 assert.match(schema,/bestReplyId: text\('best_reply_id'\)/);
 assert.match(schema,/solvedAt: integer\('solved_at'\)/);
});
test('best-answer endpoint enforces ownership, board, reply state and audit',()=>{
 const api=read('src/worker/members.ts');
 for(const value of ["status='published'","category_id AS categoryId","NOT_QUESTION_TOPIC","REPLY_NOT_AVAILABLE","topic_id=? AND status='published'","'best_answer'","topic.resolve","topic.unresolve","RATE_LIMITED"])assert.ok(api.includes(value),'best-answer must include '+value);
 assert.match(api,/FORBIDDEN/,'Non-owner non-staff members are rejected');
 assert.match(api,/INSERT OR IGNORE INTO notifications/);
});
test('topic detail restores the signed-in reader engagement state',()=>{
 const routes=read('src/worker/index.ts');
 assert.match(routes,/FROM topic_likes WHERE topic_id=\? AND user_id=\?/);
 assert.match(routes,/FROM bookmarks WHERE topic_id=\? AND user_id=\?/);
 assert.match(routes,/viewer/);
 assert.match(routes,/authorId: topics\.authorId/);
 assert.match(routes,/solvedAt: topics\.solvedAt/);
});
test('feed supports solved resolution filters scoped to the help board',()=>{
 const routes=read('src/worker/index.ts');
 assert.match(routes,/resolution/);
 assert.match(routes,/isNotNull\(topics\.solvedAt\)/);
 assert.match(routes,/eq\(topics\.categoryId, 'help'\)/);
 assert.match(routes,/solvedAt: topics\.solvedAt/);
});
test('bookmarks list stays private and published-only',()=>{
 const api=read('src/worker/members.ts');
 assert.match(api,/\/me\/bookmarks/);
 assert.match(api,/t\.status='published'/);
 assert.match(api,/ORDER BY b\.created_at DESC/);
});
test('client renders best answers, resolution filters and the bookmarks entry',()=>{
 const home=read('src/client/main.tsx'),member=read('src/client/member.tsx'),notices=read('src/client/notifications.tsx'),css=read('src/client/styles.css');
 for(const value of ['resolution','solved-tag','open-tag','BookmarksDialog','我的收藏'])assert.ok(home.includes(value),value);
 for(const value of ['best-answer','bestId','canAccept','取消采纳','BookmarksDialog','solved-pill','open-pill'])assert.ok(member.includes(value),value);
 for(const value of ['best-reply','best-answer-badge','accept-button','filter-groups'])assert.ok(css.includes(value),value);
 assert.match(notices,/best_answer/);
 assert.match(notices,/你的回复被采纳为最佳答案/);
});
