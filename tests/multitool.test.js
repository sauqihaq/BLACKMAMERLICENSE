import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {CATALOG,isTool} from '../lib/catalog.js';
import {KEY_REGEX,newKey,publicLicense} from '../lib/common.js';
test('each distinct product can issue a correctly branded license',()=>{
 assert.equal(CATALOG.length,4);
 for(const p of CATALOG){assert.ok(isTool(p.slug));const k=newKey(p.slug);assert.ok(KEY_REGEX.test(k),p.slug+' '+k);}
 assert.equal(isTool('unknown'),false);
});
test('licensed product must remain visible in admin API output',()=>{
 const output=publicLicense({id:'abc',tool_slug:'meshy',key_tail:'ABCDE',customer:'Tester',plan:'Pro',status:'active',check_count:4});
 assert.equal(output.tool,'meshy');
 assert.match(output.keyMasked,/BM-MESHY/);
 assert.equal(output.checkCount,4);
});
test('storefront and admin images exist and all product cards are represented',()=>{
 const ui=readFileSync('public/index.html','utf8');
 const admin=readFileSync('public/admin.html','utf8');
 assert.match(ui,/id="buy-install"/);
 assert.match(admin,/id="create-tool"/);
 assert.match(admin,/id="tab-store"/);
 for(const p of CATALOG)assert.ok(existsSync('public'+p.image),p.image);
});
test('client is tool-specific and uses a licensing endpoint',()=>{
 const source=readFileSync('public/tool-client-template.user.js','utf8');
 assert.match(source,/__API_BASE__/);
 assert.match(source,/__TOOL__/);
 assert.match(source,/\/api\/license\//);
 assert.match(source,/request\('validate','download'\)/);
});
