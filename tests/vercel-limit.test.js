import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
function endpoints(d){return readdirSync(d,{withFileTypes:true}).flatMap(f=>f.isDirectory()?endpoints(join(d,f.name)):f.name.endsWith('.js')?[join(d,f.name)]:[]);}
test('Vercel Hobby max 12 Functions',()=>{const files=endpoints('api');assert.ok(files.length<=12,'Exceeded Hobby Functions: '+files.length);});
test('legacy API URLs remain routable after consolidation',()=>{const v=JSON.parse(readFileSync('vercel.json','utf8'));const r=Object.fromEntries(v.rewrites.map(o=>[o.source,o.destination]));assert.equal(r['/api/store'],'/api/health?view=store');assert.equal(r['/api/admin/store'],'/api/admin/summary?view=store');assert.equal(r['/api/install-tool'],'/api/install');assert.match(v.functions['api/install.js'].includeFiles,/\.user\.js/);});
