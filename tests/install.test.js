import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import install from '../api/install.js';

function fakeRes(){return {statusCode:200,headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v;},end(x){this.text=x??'';this.headersSent=true;}};}
test('installer injects current deployment origin and retains metadata and downloads',async()=>{
 const req={method:'GET',headers:{host:'my-license.vercel.app'}};const res=fakeRes();await install(req,res);
 assert.equal(res.statusCode,200);assert.match(res.text,/^\/\/ ==UserScript==/);
 assert.ok(res.text.includes("API_BASE_URL: 'https://my-license.vercel.app'"));
 assert.ok(!res.text.includes('https://GANTI-PROJECT.vercel.app'));
 assert.ok(res.text.includes('async function convertCaptured(format)'));
 assert.ok(res.text.includes('async function downloadFile(url, filename)'));
 assert.ok(res.text.includes('bm-license-name'));
 assert.ok(res.text.includes("checkAccess('download')"));
 assert.ok(res.text.includes("checkAccess('convert')"));
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
