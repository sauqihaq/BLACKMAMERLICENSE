import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('admin custom duration has manual number input and lifetime checkbox',()=>{
 const source=readFileSync('public/admin-delivery.js','utf8');
 assert.match(source,/delivery-days.*type=\\"number\\"/);
 assert.match(source,/min=\\"1\\" max=\\"3650\\"/);
 assert.match(source,/delivery-lifetime/);
 assert.match(source,/\?\s*'lifetime'\s*:\s*Number\(/);
 assert.doesNotMatch(source,/<option value=\\"7\\">7 Days/);
});
