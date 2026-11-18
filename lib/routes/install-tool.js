import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {apiHandler,method,error} from '../common.js';
import {CATALOG} from '../catalog.js';
import {obfuscateUserscript} from '../obfuscate.js';
export default apiHandler(async(req,res)=>{
  if(!method(req,res,['GET']))return;
  const tool=String(req.query?.tool||'');
  if(tool==='tripo'){
    res.statusCode=302;res.setHeader('Location','/api/install');return res.end();
  }
  const item=CATALOG.find(p=>p.slug===tool);
  if(!item)return error(res,404,'NO_TOOL','Produk tidak ditemukan.');
  const host=String(req.headers.host||'').toLowerCase();
  if(!/^(?:[a-z0-9-]+\.)*[a-z0-9-]+(?::\d{1,5})?$/.test(host))return error(res,400,'BAD_HOST','Host salah.');
  const origin=(host.startsWith('localhost:')?'http':'https')+'://'+host;
  let data=await readFile(join(process.cwd(),'userscript','tool-client-template.user.js'),'utf8');
  const matches=tool==='meshy'?['https://www.meshy.ai/*','https://meshy.ai/*']:['https://sketchfab.com/*','https://www.sketchfab.com/*'];
  data=data.replaceAll('__TITLE__',item.name).replaceAll('__TOOL__',tool).replaceAll('__API_BASE__',origin)
    .replaceAll('__API_HOST__',host.split(':')[0]).replace('__MATCH_A__',matches[0]).replace('__MATCH_B__',matches[1]);
  res.statusCode=200;res.setHeader('Content-Type','text/javascript; charset=utf-8');res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Disposition','attachment; filename="BLACKMAMER_'+tool+'.user.js"');res.end(obfuscateUserscript(data));
});
