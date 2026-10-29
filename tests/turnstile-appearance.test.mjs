import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('managed Turnstile uses interaction-only appearance without removing token checks',()=>{
 const client=read('src/client/turnstile.tsx');
 const server=read('src/worker/turnstile.ts');
 assert.match(client,/appearance:'interaction-only'/);
 assert.doesNotMatch(client,/提交前请完成人机验证/);
 assert.match(client,/callback:t=>/);
 assert.match(client,/'expired-callback'/);
 assert.match(client,/'error-callback'/);
 assert.match(client,/window.turnstile.remove\(widget\)/);
 assert.match(server,/siteverify/);
 assert.match(server,/result.success===true&&result.hostname===hostname/);
});
test('success widget does not reserve extra margin, errors stay visible',()=>{
 const css=read('src/client/styles.css');
 assert.match(css,/\.turnstile-panel\{margin:0/);
 const field=read('src/client/turnstile.tsx');
 assert.match(field,/error&&<p className="member-error" role="alert">/);
});
