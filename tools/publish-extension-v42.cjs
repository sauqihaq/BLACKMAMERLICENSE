#!/usr/bin/env node
'use strict';
/**
 * One-shot owner-controlled release build, run by GitHub Actions.
 * Unpacks the existing V4 distribution, installs anti-tamper controls,
 * statically obfuscates JS without eval, signs files with an ephemeral private key,
 * and replaces public/downloads/BlackMamer-v4.zip in the SAME commit pipeline.
 * Private signing key never leaves the action runner, and is not committed.
 */
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const cp=require('node:child_process');
const crypto=require('node:crypto');
const ts=require('typescript');
const repo=path.resolve(__dirname,'..');
const zipPath=path.join(repo,'public/downloads/BlackMamer-v4.zip');
const rootName='BlackMamer-v4';
const namesToObfuscate=['background.js','extension.js','editor.js','content.js','page.js','offscreen.js','popup.js','studio.js','bm-theme.js','bm-site-bridge.js','bm-install.js','lint.js','cache.js'];
const protectedFiles=['manifest.json','background.js','extension.js','editor.js','content.js','page.js','popup.html','popup.js','dashboard.html','studio.js','studio.css','bm-theme.js','bm-theme.css','style.css','editor.css','bm-site-bridge.js','bm-install.js','bm-install.html','options.html','offscreen.js','offscreen.html','action.html','ask.html','userscript.html','bm-help.html','bm-help.css','images/icon128.png','images/blackmamer-original.png','bm-ui-lock.js','LICENSE-BLACKMAMERSTUDIO.txt','lint.js','cache.js'];
const TMP=fs.mkdtempSync(path.join(os.tmpdir(),'bm-release-'));
const root=path.join(TMP,rootName);
function read(file){return fs.readFileSync(path.join(root,file),'utf8');}
function write(file,value){fs.writeFileSync(path.join(root,file),value,'utf8');}
function replaceExact(s,needle,change,file){const count=s.split(needle).length-1;if(count!==1)throw Error(`Refusing unsafe patch ${file}: ${count} occurrences for ${needle.slice(0,50)}`);return s.replace(needle,change);}
function obfuscate(code,name){
  const ast=ts.createSourceFile(name,code,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  if(ast.parseDiagnostics.length)throw Error(name+' AST parse failure: '+ast.parseDiagnostics[0].messageText);
  const id='__BMS_'+crypto.randomBytes(5).toString('hex');
  const salts=Array.from(crypto.randomBytes(16)),entries=[],table=[],index=new Map();
  const selector=crypto.createHash('sha256').update(name).digest();
  const choose=(value,at)=>value.length>=7&&value.length<=220&&!/^(?:use strict|__esModule)$/.test(value)&&((at+value.length*11+selector[at%selector.length])%100)<(value.length>=24?74:51);
  const unsuitable=(node,p)=>!p||(ts.isExpressionStatement(p)&&p.expression===node)||
    ((ts.isPropertyAssignment(p)||ts.isMethodDeclaration(p)||ts.isPropertyDeclaration(p)||ts.isPropertySignature(p)||ts.isGetAccessorDeclaration(p)||ts.isSetAccessorDeclaration(p))&&p.name===node)||
    ts.isImportDeclaration(p)||ts.isExportDeclaration(p)||ts.isExternalModuleReference(p)||ts.isImportTypeNode(p)||ts.isLiteralTypeNode(p)||
    ts.isImportSpecifier(p)||ts.isExportSpecifier(p)||(ts.isBindingElement(p)&&p.propertyName===node)||ts.isComputedPropertyName(p)||
    (ts.isCallExpression(p)&&p.arguments.includes(node)&&ts.isIdentifier(p.expression)&&['importScripts','require'].includes(p.expression.text));
  const encode=(value,i)=>{
    const result=Buffer.allocUnsafe(value.length*2);
    for(let j=0;j<value.length;j++){
      const mask=(((salts[(j+i*7)%salts.length]<<8)|salts[(j+i*3)%salts.length])^((j*257+i*73)&65535))&65535;
      const encrypted=value.charCodeAt(j)^mask;
      result[2*j]=encrypted&255;result[2*j+1]=encrypted>>>8;
    }
    return result.toString('base64');
  };
  function walk(node){
    if(ts.isStringLiteral(node)&&!unsuitable(node,node.parent)&&choose(node.text,node.getStart(ast))){
      let i=index.get(node.text);
      if(i===undefined){i=table.length;index.set(node.text,i);table.push(encode(node.text,i));}
      entries.push({start:node.getStart(ast),end:node.getEnd(),text:`(${id}(${i}))`});
    }
    ts.forEachChild(node,walk);
  }
  walk(ast);
  if(!entries.length)return {code,count:0};
  let insert=0;
  for(const stmt of ast.statements){if(ts.isExpressionStatement(stmt)&&ts.isStringLiteral(stmt.expression)){insert=stmt.end;continue;}break;}
  const decoder=`\n/* BLACKMAMERSTUDIO static MV3-safe obfuscation */\nconst ${id}=(()=>{const d=${JSON.stringify(table)},k=${JSON.stringify(salts)},c=[];return i=>{if(c[i]!==undefined)return c[i];const b=atob(d[i]),n=b.length>>1,o=new Array(n);for(let j=0;j<n;j++){const m=(((k[(j+i*7)%k.length]<<8)|k[(j+i*3)%k.length])^((j*257+i*73)&65535))&65535;o[j]=String.fromCharCode(((b.charCodeAt(j*2)|b.charCodeAt(j*2+1)<<8)^m)&65535)}return c[i]=o.join('')}})();\n`;
  // Replacements from end to start preserve offsets; insert AFTER transformations at original offset.
  for(const ent of entries.sort((a,b)=>b.start-a.start))code=code.slice(0,ent.start)+ent.text+code.slice(ent.end);
  code=code.slice(0,insert)+decoder+code.slice(insert);
  return {code,count:entries.length};
}
const guard=String.raw`/* BLACKMAMERSTUDIO signed integrity guard — official client-side checks. */
(()=>{
 'use strict';
 const KEY='__PUBLIC_SPki_B64__';
 const ERROR='BLACKMAMERSTUDIO: integritas UI / branding tidak valid. Gunakan paket resmi tanpa mengganti nama BLACKMAMER atau file extension.';
 let lastAt=0,good=false,inflight=null,locked=false;
 const b64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
 const hash=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');
 const stable=v=>Array.isArray(v)?'['+v.map(stable).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}':JSON.stringify(v);
 async function lock(e){
   if(locked)return;locked=true;console.error('[BLACKMAMERSTUDIO] Build locked: tamper detected.',e?.message);
   try{await chrome.storage.local.set({bmBrandLock:{locked:true,reason:'Asset integrity check failed',at:Date.now()}});}catch{}
   try{const engine=globalThis.BMEngine;if(engine?.enabled)await engine.enabled(false);}catch{}
   try{const scripts=await chrome.userScripts.getScripts();if(scripts.length)await chrome.userScripts.unregister({ids:scripts.map(s=>s.id)});}catch{}
 }
 async function run(){
   const response=await fetch(chrome.runtime.getURL('bm-brand-seal.json'),{cache:'no-store'});
   if(!response.ok)throw Error('Official seal missing');
   const {payload:p,signature}=await response.json();
   if(!p||p.brand!=='BLACKMAMERSTUDIO'||p.product!=='BlackMamer'||p.policy!=='official-asset-integrity-v1'||!p.files||typeof signature!=='string')throw Error('Invalid signed metadata');
   const key=await crypto.subtle.importKey('spki',b64(KEY),{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
   if(!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,b64(signature),new TextEncoder().encode(stable(p))))throw Error('Invalid official signature');
   const manifest=chrome.runtime.getManifest();
   if(manifest.name!=='BlackMamer'||manifest.short_name!=='BlackMamer'||manifest.version!==p.version||manifest.version_name!==p.versionName||!manifest.action?.default_title?.includes('BLACKMAMERSTUDIO'))throw Error('BLACKMAMERSTUDIO name changed');
   for(const [filename,expected] of Object.entries(p.files)){
     if(!/^[a-zA-Z0-9_./-]+$/.test(filename)||filename.includes('..')||!/[a-f0-9]{64}/.test(expected))throw Error('Invalid asset metadata');
     const file=await fetch(chrome.runtime.getURL(filename),{cache:'no-store'});
     if(!file.ok)throw Error('Missing asset '+filename);
     if(hash(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))!==expected)throw Error('Modified asset '+filename);
   }
   if(locked)throw Error('Install clean official extension and reload');
   try{await chrome.storage.local.remove('bmBrandLock');}catch{}
   return true;
 }
 const verify=(force=false)=>{
   if(locked)return Promise.reject(Error(ERROR));
   if(!force&&good&&Date.now()-lastAt<15000)return Promise.resolve(true);
   if(inflight)return inflight;
   inflight=run().then(x=>{good=true;lastAt=Date.now();return x;}).catch(async e=>{await lock(e);throw Error(ERROR);}).finally(()=>{inflight=null;});
   return inflight;
 };
 globalThis.BMBrandGuard=Object.freeze({verify,isLocked:()=>locked});
})();
`;
const uiLock=String.raw`/* BLACKMAMERSTUDIO official signed UI — engine enforces the lock. */
(()=>{
 'use strict';let locked=false;
 function showLocked(message){
   if(locked)return;locked=true;
   const overlay=document.createElement('div');overlay.className='bm-integrity-overlay';
   const box=document.createElement('div');box.className='bm-integrity-box';
   const title=document.createElement('strong');title.textContent='BLACKMAMERSTUDIO · EXTENSION TERKUNCI';
   const body=document.createElement('p');body.textContent=message||'File extension atau identitas BLACKMAMER telah berubah. Install ulang paket resmi.';
   const note=document.createElement('small');note.textContent='Perubahan UI atau branding pada build resmi tidak diperbolehkan. Data pribadi tidak dihapus.';
   box.append(title,body,note);overlay.append(box);document.body.append(overlay);
 }
 async function check(){
   try{const response=await chrome.runtime.sendMessage({bm:{action:'brand-check'}});
     if(!response?.ok||response.result?.verified!==true)throw Error(response?.error||'Verifikasi build gagal');
   }catch(e){showLocked(e?.message||'Verifikasi integritas gagal');}
 }
 document.addEventListener('DOMContentLoaded',check);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!locked)check();});
 setInterval(()=>{if(!document.hidden&&!locked)check();},60000);
})();
`;
const notice=`BLACKMAMERSTUDIO — OFFICIAL BUILD / BRANDING NOTICE\n\nOwner-controlled additions include BLACKMAMER branding, UI assets, licensed-delivery integration, and integrity controls.\nUnauthorized repackaging or impersonation as an official BLACKMAMERSTUDIO build is prohibited by the rights holder.\nUnderlying third-party software remains subject to its own licenses. Preserve the original license and attribution files.\nLocal client-side integrity checks can be bypassed by someone controlling the installed source files; server-side license authorization remains essential.\n`;
function build(){
  if(!fs.existsSync(zipPath))throw Error('Original ZIP absent: '+zipPath);
  cp.execFileSync('unzip',['-qq',zipPath,'-d',TMP]);
  if(!fs.existsSync(path.join(root,'manifest.json')))throw Error('Original ZIP layout unexpected');
  if(fs.existsSync(path.join(root,'bm-brand-seal.json'))){console.log('Already signed; preserving ZIP.');return;}
  let bg=read('background.js');
  bg=replaceExact(bg,'/* BlackMamer owned UI and licensed delivery. Source is never returned to the store bridge. */',
    "/* BlackMamer owned UI and licensed delivery. Source is never returned to the store bridge. */\nimportScripts('bm-brand-guard.js');\nconst bmBrandReady=BMBrandGuard.verify(true);",'background.js');
  bg=replaceExact(bg,'async function bmReady(){await bmStateReady;',
    'async function bmReady(){await bmBrandReady;await BMBrandGuard.verify();await bmStateReady;','background.js');
  bg=replaceExact(bg,' const run=async()=>{\n  const own=sender.id',
    ' const run=async()=>{\n  await BMBrandGuard.verify();\n  const own=sender.id','background.js');
  bg=replaceExact(bg,"chrome.alarms.create('bm-license-check',{periodInMinutes:5});",
    "chrome.alarms.create('bm-license-check',{periodInMinutes:5});\nchrome.alarms.onAlarm.addListener(a=>{if(a.name==='bm-brand-check')BMBrandGuard.verify(true).catch(()=>{});});\nchrome.alarms.create('bm-brand-check',{periodInMinutes:1});",'background.js');
  bg=replaceExact(bg,'Ih();})();})();',
    "bmBrandReady.then(()=>Ih(),()=>console.error('[BLACKMAMERSTUDIO] Engine startup disabled: integrity failed'));})();})();",'background.js');
  bg=replaceExact(bg,"  case 'state':{let scriptsAllowed=false;",
    "  case 'brand-check':return {verified:true,brand:'BLACKMAMERSTUDIO'};\n  case 'state':{let scriptsAllowed=false;",'background.js');
  write('background.js',bg);
  const manifest=JSON.parse(read('manifest.json'));
  Object.assign(manifest,{version:'5.6.3',version_name:'4.2.0',name:'BlackMamer',short_name:'BlackMamer',
    description:'BLACKMAMERSTUDIO official V4.2 obfuscated and digitally signed licensed build.'});
  manifest.action.default_title='BLACKMAMERSTUDIO — Official Licensed Build';
  write('manifest.json',JSON.stringify(manifest,null,2)+'\n');
  for(const [name,needle,script] of [
    ['popup.html','<div class="eyebrow">YOUR BROWSER, ORGANIZED.</div>','<script src="popup.js" defer></script>'],
    ['dashboard.html','<div class="workspace"><header class="topbar">','<script src="studio.js" defer></script>']]){
    let html=read(name);
    const badge='<span class="bm-signed-stamp" title="Official BLACKMAMERSTUDIO build">BLACKMAMERSTUDIO · SIGNED BUILD</span>';
    html=replaceExact(html,needle,name==='popup.html'?badge+needle:needle+badge,name);
    html=replaceExact(html,script,'<script src="bm-ui-lock.js" defer></script>'+script,name);
    write(name,html);
  }
  write('popup.js',read('popup.js').replace("catch(e){$('popup-info').textContent=e.message;}","catch(e){$('popup-info').textContent=e.message;if(/BLACKMAMERSTUDIO|integritas|brand/i.test(e.message)){$('popup-toggle').disabled=true;}}"));
  write('studio.css',read('studio.css')+'\n.bm-signed-stamp{display:inline-block;font-size:9px;letter-spacing:.12em;font-weight:850;color:#d89aa9;background:#2b2029;border:1px solid #744454;border-radius:7px;padding:5px 8px;margin:4px 12px 6px 0}\n.bm-integrity-overlay{position:fixed!important;inset:0!important;background:#080a0cf7!important;z-index:2147483647!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:24px!important;color:#eee!important;font:14px/1.65 system-ui,sans-serif!important}.bm-integrity-box{max-width:450px;padding:28px;background:#241b24;border:1px solid #b35a6b;border-radius:18px;box-shadow:0 0 65px #000b}.bm-integrity-box strong{display:block;font-size:17px;letter-spacing:.04em;color:#ffb4c4;margin-bottom:10px}.bm-integrity-box p{color:#d8b6c2;margin:0 0 10px}.bm-integrity-box small{color:#ab8e9c}\n');
  const {privateKey,publicKey}=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  const key=publicKey.export({type:'spki',format:'der'}).toString('base64');
  write('bm-brand-guard.js',guard.replace('__PUBLIC_SPki_B64__',key));
  write('bm-ui-lock.js',uiLock);write('LICENSE-BLACKMAMERSTUDIO.txt',notice);
  write('README.md',read('README.md')+'\n\n## Official BLACKMAMERSTUDIO v4.2\nThis official extension uses a signed asset manifest and static MV3-compatible JavaScript obfuscation. It checks branding, engine/UI source and 32 assets at startup and regularly; invalid assets disable the extension. Existing website-bound product licenses are preserved; no second key entry is needed. Signing private key is not included in the distribution. Integrity checks can be bypassed by an adversary controlling local files, so license enforcement must remain server-side.\n');
  let total=0;
  for(const name of namesToObfuscate){if(!fs.existsSync(path.join(root,name)))continue;
    const result=obfuscate(read(name),name);write(name,result.code);total+=result.count;
    try{cp.execFileSync('node',['--check',path.join(root,name)],{stdio:'pipe'});}catch(e){throw Error('Obfuscation syntax failed '+name+': '+String(e.stderr).slice(-500));}
  }
  const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
  const files={};for(const f of protectedFiles){if(!fs.existsSync(path.join(root,f)))throw Error('Missing signed asset '+f);files[f]=sha(f);}
  const payload={brand:'BLACKMAMERSTUDIO',product:'BlackMamer',version:'5.6.3',versionName:'4.2.0',policy:'official-asset-integrity-v1',files};
  const stable=v=>Array.isArray(v)?'['+v.map(stable).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}':JSON.stringify(v);
  const signature=crypto.sign('sha256',Buffer.from(stable(payload)),{key:privateKey,dsaEncoding:'ieee-p1363'}).toString('base64');
  if(!crypto.verify('sha256',Buffer.from(stable(payload)),{key:publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(signature,'base64')))throw Error('Signature self-test failed');
  write('bm-brand-seal.json',JSON.stringify({payload,signature},null,2)+'\n');
  cp.execFileSync('zip',['-qr','-9',zipPath,rootName],{cwd:TMP});
  const zip=cp.execFileSync('unzip',['-Z','-1',zipPath],{encoding:'utf8'});
  if(!zip.includes(rootName+'/bm-brand-seal.json'))throw Error('Built ZIP missing signature');
  console.log(`BLACKMAMERSTUDIO V4.2 verified and staged: obfuscated ${total} string literals, ${Object.keys(files).length} signed resources, ZIP ${fs.statSync(zipPath).size} bytes.`);
}
try{build();}finally{fs.rmSync(TMP,{recursive:true,force:true});}