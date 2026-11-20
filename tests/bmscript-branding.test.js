import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('public website uses BMscript branding while preserving standard script metadata',()=>{
 const a=readFileSync('public/admin-delivery.js','utf8');
 const b=readFileSync('public/install.html','utf8');
 const c=readFileSync('public/extension-page.js','utf8');
 const engine=readFileSync('lib/delivery.js','utf8');
 assert.match(a,/FILE BMscript/);assert.match(b,/LICENSED BMscript/);
 assert.match(b,/Install BMscript/);assert.match(c,/memasang BMscript/);
 assert.match(engine,/Metadata BMscript/);assert.match(engine,/==UserScript==/);
 assert.ok(a.includes('.user.js'),'Chrome-compatible .user.js format remains supported');
 for(const file of [a,b,c])assert.doesNotMatch(file,/\buserscripts?\b/i);
});
