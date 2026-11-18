import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
mock.module('@neondatabase/serverless',{namedExports:{neon:()=>({query:async(s,p)=>(await db.query(s,p)).rows})}});
process.env.DATABASE_URL='postgresql://local-test';process.env.ADMIN_SESSION_SECRET='test-only-secret-'.repeat(4);process.env.ADMIN_PASSWORD='test-password-123456';
const {setup,query}=await import('../lib/store.js');
const d=await import('../lib/delivery.js');
const admin=(await import('../lib/routes/admin-delivery.js')).default;
const route=(await import('../lib/routes/delivery.js')).default;
const {createSession}=await import('../lib/auth.js');
const source='// ==UserScript==\n// @name Test Licensed Tool\n// @version 1.2\n// @match https://example.com/*\n// @grant none\n// ==/UserScript==\nwindow.testLicensed=true;';
const res=()=>({statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},end(v){this.body=JSON.parse(v);}});
const device=()=> 'bmdev_'+randomUUID(), proof=()=>randomBytes(32).toString('hex');
async function license(){const id=randomUUID();await query(`INSERT INTO bm_tripo_licenses(id,key_hash,key_tail,customer,plan,tool_slug)VALUES($1,$2,'ABCDE','Test buyer','Personal','tripo')`,[id,d.hash(id)]);return id;}
await setup();
test('private delivery with real PostgreSQL semantics',async t=>{
 await t.test('source metadata, authenticated encryption and expiry validation',()=>{
  assert.equal(d.parseSource(source).name,'Test Licensed Tool');assert.throws(()=>d.parseSource('alert(1)'));assert.throws(()=>d.parseSource(source.replace('https://example.com/*','javascript:bad')));
  const encrypted=d.seal(source);assert.ok(!encrypted.includes('window.testLicensed'));assert.equal(d.unseal(encrypted),source);assert.throws(()=>d.unseal(encrypted.slice(0,-4)+'AAAA'));
  assert.throws(()=>d.linkExpiry(new Date(Date.now()-1000).toISOString()));assert.throws(()=>d.linkExpiry('invalid'));
 });
 const script=await d.saveProduct('tripo',source),id=await license();
 const link=await d.issueLink(id,new Date(Date.now()+86400000).toISOString()),a=device(),pa=proof();
 await t.test('metadata never contains source or session; token stored only as a hash',async()=>{
  const info=await d.describeLink(link.token);assert.equal(info.status,'ready');assert.equal(info.name,'Test Licensed Tool');assert.ok(!JSON.stringify(info).includes('window.testLicensed'));
  const [row]=await query('SELECT * FROM bm_install_links WHERE id=$1',[link.id]);assert.equal(row.token_hash,d.hash(link.token));assert.ok(!JSON.stringify(row).includes(link.token));
 });
 let claimed;
 await t.test('claim is one browser; matching retry is idempotent; token alone cannot steal retry',async()=>{
  claimed=await d.claimLink(link.token,a,pa);assert.equal(claimed.device_id,a);assert.equal(claimed.script_id,script.id);
  const retry=await d.claimLink(link.token,a,pa);assert.equal(d.credential(retry),d.credential(claimed));
  assert.equal(await d.claimLink(link.token,device(),proof()),null);assert.equal(await d.claimLink(link.token,a,proof()),null);
  const [l]=await query('SELECT device_id FROM bm_tripo_licenses WHERE id=$1',[id]);assert.equal(l.device_id,a);
 });
 await t.test('existing links deliver executable obfuscated source with matching hash on retries',async()=>{
  const first=res(),second=res();
  const request={method:'POST',headers:{},body:{action:'claim',token:link.token,deviceId:a,proof:pa}};
  await route(request,first);await route(request,second);
  assert.equal(first.statusCode,200);
  const pkg=first.body.package;
  assert.notEqual(pkg.source,source);
  assert.equal(pkg.sourceHash,d.hash(pkg.source));
  assert.equal(second.body.package.source,pkg.source);
  assert.deepEqual(d.parseSource(pkg.source),d.parseSource(source));
  const sandbox={window:{}};
  runInNewContext(pkg.source,sandbox,{timeout:1000});
  assert.equal(sandbox.window.testLicensed,true);
 });
 await t.test('session remains valid after link expiry but not license expiry/revocation/reset',async()=>{
  const s=d.credential(claimed);assert.ok(await d.validateSession(s,a,'tripo'));assert.equal(await d.validateSession(s,a,'meshy'),null);assert.equal(await d.validateSession(s,device(),'tripo'),null);
  await query("UPDATE bm_install_links SET expires_at=NOW()-INTERVAL '1 hour' WHERE id=$1",[link.id]);assert.ok(await d.validateSession(s,a,'tripo'));
  await query("UPDATE bm_tripo_licenses SET status='revoked' WHERE id=$1",[id]);assert.equal(await d.validateSession(s,a,'tripo'),null);
  await query("UPDATE bm_tripo_licenses SET status='active',expires_at=NOW()-INTERVAL '1 hour' WHERE id=$1",[id]);assert.equal(await d.validateSession(s,a,'tripo'),null);
  await query('UPDATE bm_tripo_licenses SET expires_at=NULL,device_id=NULL WHERE id=$1',[id]);assert.equal(await d.validateSession(s,a,'tripo'),null);
 });
 await t.test('expired unclaimed links and revoked links fail closed',async()=>{
  const l=await d.issueLink(await license(),new Date(Date.now()+86400000).toISOString());await query("UPDATE bm_install_links SET expires_at=NOW()-INTERVAL '1 second' WHERE id=$1",[l.id]);assert.equal(await d.claimLink(l.token,device(),proof()),null);
  const l2=await d.issueLink(await license(),new Date(Date.now()+86400000).toISOString());await query('UPDATE bm_install_links SET revoked=TRUE WHERE id=$1',[l2.id]);assert.equal(await d.claimLink(l2.token,device(),proof()),null);
 });
 await t.test('two simultaneous browsers cannot claim same link or distinct links for one license',async()=>{
  const l=await d.issueLink(await license(),new Date(Date.now()+86400000).toISOString());const results=await Promise.all([d.claimLink(l.token,device(),proof()),d.claimLink(l.token,device(),proof())]);assert.equal(results.filter(Boolean).length,1);
  const id=await license(),l1=await d.issueLink(id,new Date(Date.now()+86400000).toISOString()),l2=await d.issueLink(id,new Date(Date.now()+86400000).toISOString());const distinct=await Promise.all([d.claimLink(l1.token,device(),proof()),d.claimLink(l2.token,device(),proof())]);assert.equal(distinct.filter(Boolean).length,1);
 });
 await t.test('new source versions do not change already issued links',async()=>{
  const l=await d.issueLink(await license(),new Date(Date.now()+86400000).toISOString());await d.saveProduct('tripo',source.replace('1.2','2.0'));assert.equal((await d.describeLink(l.token)).version,'1.2');
 });
 await t.test('auto access is product-bound, uploaded-only and no second key input',async()=>{
  // A legacy / template script is not eligible to issue new access.
  await query("INSERT INTO bm_product_scripts(id,tool_slug,name,version,matches,source_cipher,source_hash,source_kind)VALUES($1,'meshy','OLD TEMPLATE','0.1','[]'::jsonb,$2,$3,'legacy')",
    [randomUUID(),d.seal(source),d.hash(source)]);
  await assert.rejects(d.issueAccess({tool:'meshy',customer:'Test buyer',days:7,linkExpiresAt:new Date(Date.now()+86400000).toISOString()}),/Upload userscript/);
  await d.saveProduct('meshy',source.replace('Test Licensed Tool','Meshy Manual Upload'));
  const access=await d.issueAccess({tool:'meshy',customer:'Test buyer',plan:'Personal',days:7,linkExpiresAt:new Date(Date.now()+86400000).toISOString()});
  assert.equal(access.tool,'meshy');assert.ok(!('key' in access));
  const description=await d.describeLink(access.token);
  assert.equal(description.tool,'meshy');assert.equal(description.name,'Meshy Manual Upload');
  const [linked]=await query('SELECT l.tool_slug,s.tool_slug AS script_tool,d.license_id FROM bm_install_links d JOIN bm_tripo_licenses l ON l.id=d.license_id JOIN bm_product_scripts s ON s.id=d.script_id WHERE d.id=$1',[access.linkId]);
  assert.equal(linked.tool_slug,'meshy');assert.equal(linked.script_tool,'meshy');
  // Arbitrary daily durations are accepted and persisted to the license expiry.
  const custom=await d.issueAccess({tool:'meshy',customer:'Custom 43 days',plan:'Personal',days:43,linkExpiresAt:new Date(Date.now()+86400000).toISOString()});
  const [customRow]=await query('SELECT expires_at FROM bm_tripo_licenses WHERE id=$1',[custom.licenseId]);
  const delta=(new Date(customRow.expires_at).getTime()-Date.now())/86400000;
  assert.ok(delta>42.9&&delta<=43,'License must last the custom number of days');
  const lifetime=await d.issueAccess({tool:'meshy',customer:'Lifetime buyer',days:'lifetime',linkExpiresAt:new Date(Date.now()+86400000).toISOString()});
  const [lifeRow]=await query('SELECT expires_at FROM bm_tripo_licenses WHERE id=$1',[lifetime.licenseId]);
  assert.equal(lifeRow.expires_at,null);
  await assert.rejects(d.issueAccess({tool:'meshy',customer:'Bad buyer',days:3651,linkExpiresAt:new Date(Date.now()+86400000).toISOString()}),/Masa aktif/);
  await assert.rejects(d.issueAccess({tool:'meshy',customer:'Bad buyer',days:0,linkExpiresAt:new Date(Date.now()+86400000).toISOString()}),/Masa aktif/);

  assert.equal((await d.claimLink(access.token,device(),proof())).tool_slug,'meshy');
  await assert.rejects(d.issueAccess({tool:'unknown',customer:'Test',days:7,linkExpiresAt:new Date(Date.now()+86400000).toISOString()}),/Upload userscript/);
 });
 await t.test('admin creates and renames a product without changing its license/script identity',async()=>{
  const headers={host:'localhost',origin:'http://localhost','x-bm-admin':'1',cookie:'bm_admin_session='+createSession('admin')};
  const create=res();
  await admin({method:'POST',headers,body:{
    action:'create-product',slug:'custom-blender-kit',name:'Original Blender Kit',
    description:'First product description',image:'/assets/meshy.svg'
  }},create);
  assert.equal(create.statusCode,201,JSON.stringify(create.body));
  assert.equal(create.body.product.slug,'custom-blender-kit');

  const dupe=res();
  await admin({method:'POST',headers,body:{
    action:'create-product',slug:'custom-blender-kit',name:'Duplicated Blender',
    description:'Wrong item',image:'/assets/tripo.svg'
  }},dupe);
  assert.equal(dupe.statusCode,400);
  const uploaded=await d.saveProduct('custom-blender-kit',source.replace('Test Licensed Tool','Custom Blender Script'));
  const issued=await d.issueAccess({tool:'custom-blender-kit',customer:'Renaming Buyer',days:23,linkExpiresAt:new Date(Date.now()+86400000).toISOString()});
  assert.equal(issued.tool,'custom-blender-kit');
  const originalLicense=await query('SELECT id,tool_slug FROM bm_tripo_licenses WHERE id=$1',[issued.licenseId]);
  assert.equal(originalLicense[0].tool_slug,'custom-blender-kit');

  const edited=res();
  await admin({method:'POST',headers,body:{
    action:'update-product',tool:'custom-blender-kit',name:'BLACKMAMER Blender Pro',
    description:'Updated showcase description',image:'/assets/sketchfab.svg'
  }},edited);
  assert.equal(edited.statusCode,200,JSON.stringify(edited.body));
  assert.equal(edited.body.product.slug,'custom-blender-kit');
  assert.equal(edited.body.product.name,'BLACKMAMER Blender Pro');

  const [dbProduct]=await query('SELECT * FROM bm_products WHERE slug=$1',['custom-blender-kit']);
  assert.equal(dbProduct.name,'BLACKMAMER Blender Pro');
  assert.equal(dbProduct.description,'Updated showcase description');
  assert.equal(dbProduct.image,'/assets/sketchfab.svg');
  const [linked]=await query('SELECT l.id,l.tool_slug,s.id AS script_id,s.tool_slug AS script_tool FROM bm_install_links i JOIN bm_tripo_licenses l ON l.id=i.license_id JOIN bm_product_scripts s ON s.id=i.script_id WHERE i.id=$1',[issued.linkId]);
  assert.equal(linked.id,issued.licenseId);
  assert.equal(linked.tool_slug,'custom-blender-kit');
  assert.equal(linked.script_id,uploaded.id);
  assert.equal(linked.script_tool,'custom-blender-kit');
  assert.equal((await d.describeLink(issued.token)).tool,'custom-blender-kit');
  const {default:publicStore}=await import('../lib/routes/public-store.js');
  const publicResponse=res();await publicStore({method:'GET',headers:{}},publicResponse);
  assert.equal(publicResponse.statusCode,200);
  const listing=publicResponse.body.catalog.find(p=>p.slug==='custom-blender-kit');
  assert.equal(listing.name,'BLACKMAMER Blender Pro');
  assert.equal(listing.image,'/assets/sketchfab.svg');

  const bad=res();
  await admin({method:'POST',headers,body:{
    action:'update-product',tool:'custom-blender-kit',name:'',description:'Bad',image:'/assets/tripo.svg'
  }},bad);
  assert.equal(bad.statusCode,400);
  const nonexistent=res();
  await admin({method:'POST',headers,body:{
    action:'update-product',tool:'does-not-exist',name:'Not Here',description:'',image:'/assets/tripo.svg'
  }},nonexistent);
  assert.equal(nonexistent.statusCode,404);
  const invalidImage=res();
  await admin({method:'POST',headers,body:{
    action:'update-product',tool:'custom-blender-kit',name:'New name',description:'',image:'https://evil.example/icon.svg'
  }},invalidImage);
  assert.equal(invalidImage.statusCode,400);
 });
 await t.test('admin authentication and CSRF block unauthorised source uploads',async()=>{
  const a=res();await admin({method:'POST',headers:{host:'localhost','x-bm-admin':'1'},body:{action:'upload',tool:'tripo',source}},a);assert.equal(a.statusCode,401);
  const b=res();await admin({method:'POST',headers:{host:'localhost',origin:'https://evil.example',cookie:'bm_admin_session='+createSession('admin')},body:{action:'upload',tool:'tripo',source}},b);assert.equal(b.statusCode,403);
 });
 await t.test('public endpoint validates input and never accepts a license ID in place of token',async()=>{
  const r=res();await route({method:'POST',headers:{},body:{action:'claim',token:id,deviceId:a,proof:pa}},r);assert.equal(r.statusCode,403);assert.ok(!r.body.package);
 });
 await db.close();
});
