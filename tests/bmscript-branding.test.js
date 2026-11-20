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
 assert.match(a,/\\.user\\.js/);
 for(const file of [a,b,c])assert.doesNotMatch(file,/\buserscripts?\b/i);
});
