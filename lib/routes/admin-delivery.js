import {apiHandler,method,body,http,error} from '../common.js';
import {requireAdmin} from '../auth.js';
import {query,setup,audit} from '../store.js';
import {issueLink,saveProduct} from '../delivery.js';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {CATALOG} from '../catalog.js';
export default apiHandler(async(req,res)=>{
 if(!method(req,res,['GET','POST']))return;
 if(!requireAdmin(req,res,{mutate:req.method==='POST'}))return;await setup();
 if(req.method==='GET'){
  const scripts=await query(`SELECT DISTINCT ON(tool_slug) id,tool_slug,name,version,matches,created_at FROM bm_product_scripts ORDER BY tool_slug,created_at DESC,id DESC`);
  const links=await query(`SELECT d.id,d.license_id,d.expires_at,d.claimed_at,d.revoked,d.created_at,l.customer,l.tool_slug,s.name,s.version
   FROM bm_install_links d JOIN bm_tripo_licenses l ON l.id=d.license_id JOIN bm_product_scripts s ON s.id=d.script_id ORDER BY d.created_at DESC LIMIT 100`);
  return http(res,200,{ok:true,scripts,links});
 }
 // Only authenticated admin may upload code; use a separate bounded payload limit.
 const b=req.body;if(!b||typeof b!=='object'||Array.isArray(b)||JSON.stringify(b).length>1500000)return error(res,400,'BAD_INPUT','Payload tidak valid atau terlalu besar.');
 try{
  if(b.action==='upload'||b.action==='use-template'){
   let source=b.source;
   if(b.action==='use-template'){
    const item=CATALOG.find(p=>p.slug===b.tool);if(!item)throw Error('Produk tidak ditemukan.');
    source=await readFile(join(process.cwd(),'userscript',b.tool==='tripo'?'tripo-source.user.js':'tool-client-template.user.js'),'utf8');
    const base=process.env.PUBLIC_BASE_URL||'https://blackmamerlicense.vercel.app';
    const matches=b.tool==='meshy'?['https://www.meshy.ai/*','https://meshy.ai/*']:['https://sketchfab.com/*','https://www.sketchfab.com/*'];
    source=source.replaceAll('https://GANTI-PROJECT.vercel.app',base).replaceAll('__TITLE__',item.name).replaceAll('__TOOL__',b.tool).replaceAll('__API_BASE__',base).replaceAll('__API_HOST__',new URL(base).hostname).replace('__MATCH_A__',matches[0]).replace('__MATCH_B__',matches[1]);
   }
   const script=await saveProduct(String(b.tool),source);return http(res,201,{ok:true,script});
  }
  if(b.action==='issue'){
   if(!/^[0-9a-f-]{36}$/i.test(b.licenseId||''))throw Error('Pilih lisensi.');
   const issued=await issueLink(b.licenseId,b.expiresAt);
   await audit({licenseId:b.licenseId,type:'install_link',description:'Link install dibuat oleh admin'});
   return http(res,201,{ok:true,link:{id:issued.id,expiresAt:issued.expires_at,path:'/install#token='+issued.token}});
  }
  if(b.action==='revoke-link'){
   if(!/^[0-9a-f-]{36}$/i.test(b.id||''))throw Error('ID link tidak valid.');
   const [r]=await query('UPDATE bm_install_links SET revoked=TRUE WHERE id=$1 RETURNING id',[b.id]);
   return r?http(res,200,{ok:true}):error(res,404,'NOT_FOUND','Link tidak ditemukan.');
  }
  return error(res,400,'BAD_ACTION','Aksi tidak dikenal.');
 }catch(e){if(e.message?.includes('database')||e.code)throw e;return error(res,400,'INVALID_INPUT',e.message);}
});
