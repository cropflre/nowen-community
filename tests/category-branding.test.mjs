import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Video category label becomes 弄文影视 without renaming stored identifiers',()=>{
 const ui=read('src/client/main.tsx');
 const migration=read('migrations/0004_rename_video_category.sql');
 const admin=read('src/client/admin.tsx');
 assert.match(ui,/id:'video',name:'弄文影视'/);
 assert.doesNotMatch(ui,/name:'弄文视频'/);
 assert.match(migration,/UPDATE categories SET name='弄文影视' WHERE id='video' AND name='弄文视频'/);
 assert.match(admin,/video:'nowen-video'/);
});
