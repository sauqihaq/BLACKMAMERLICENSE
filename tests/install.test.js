import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import install from '../api/install.js';
import {Script} from 'node:vm';
import {parseSource} from '../lib/delivery.js';

function fakeRes(){return {statusCode:200,headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v;},end(x){this.text=x??'';this.headersSent=true;}};}
test('installer delivers obfuscated executable JavaScript with original metadata',async()=>{
 const req={method:'GET',headers:{host:'my-license.vercel.app'}};const res=fakeRes();await install(req,res);
 assert.equal(res.statusCode,200);assert.match(res.text,/^\/\/ ==UserScript==/);
 const original=readFileSync('userscript/tripo-source.user.js','utf8');
 const metadata=text=>text.match(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/)[0];
 assert.deepEqual(parseSource(metadata(res.text)),parseSource(metadata(original)));
 assert.notEqual(res.text,original);
 assert.ok(!res.text.includes('https://GANTI-PROJECT.vercel.app'));
 assert.ok(!res.text.includes('async function convertCaptured(format)'));
 new Script(res.text);
 assert.match(res.headers['content-disposition'],/\.user\.js/);
});
test('installer rejects host-header injection',async()=>{
 const req={method:'GET',headers:{host:"evil.test';alert(1);//"}};const res=fakeRes();await install(req,res);
 assert.equal(res.statusCode,400);
});
test('admin has searchable license/users/activity controls and Vercel API paths',()=>{
 const admin=readFileSync(join(process.cwd(),'public','admin.html'),'utf8');
 const js=readFileSync(join(process.cwd(),'public','admin.js'),'utf8');
 for(const name of ['recent-users','recent-activity','license-rows','event-rows','create-form','login-form','manage-modal'])assert.ok(admin.includes(name),name);
 for(const route of ['/api/admin/summary','/api/admin/licenses','/api/admin/events','/api/admin/license-action','/api/admin/login'])assert.ok(js.includes(route),route);
 assert.ok(!admin.includes('ADMIN_SESSION_SECRET'));
 assert.ok(!admin.includes('ADMIN_PASSWORD'));
});
