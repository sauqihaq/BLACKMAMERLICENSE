import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext,Script} from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';
import {obfuscateUserscript} from '../lib/obfuscate.js';

const header='// ==UserScript==\n// @name Example\n// @match https://example.com/*\n// @grant GM_getValue\n// ==/UserScript==';
test('obfuscation preserves metadata, attribution, GM API and observable behavior',()=>{
 const input=header+'\n/*! MIT License. Copyright Example */\n(async()=>{const license=GM_getValue("license");window.result=license+" converted";})();';
 const output=obfuscateUserscript(input);
 assert.ok(output.startsWith(header));
 assert.match(output,/MIT License/);
 assert.ok(!output.includes('const license='));
 assert.ok(!output.includes('sourceMappingURL'));
 const sandbox={window:{},GM_getValue:()=> 'active'};
 runInNewContext(output,sandbox,{timeout:1000});
 assert.equal(sandbox.window.result,'active converted');
 assert.equal(obfuscateUserscript(input),output);
 assert.throws(()=>obfuscateUserscript(header+'\nconst broken = ;'));
});
test('original templates are server-only and all template types can be transformed',()=>{
 for(const filename of ['tripo-source.user.js','tool-client-template.user.js']){
  assert.equal(existsSync('public/'+filename),false);
  const source=readFileSync('userscript/'+filename,'utf8');
  const result=obfuscateUserscript(source);
  assert.ok(result.startsWith('// ==UserScript=='));
  assert.notEqual(result,source);
  new Script(result);
 }
});
