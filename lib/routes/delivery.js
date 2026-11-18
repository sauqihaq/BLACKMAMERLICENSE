import {apiHandler,method,body,http,error,publicCors} from '../common.js';
import {claimLink,describeLink,credential,unseal,validateSession,hash,adaptLegacyLicense} from '../delivery.js';
import {obfuscateUserscript} from '../obfuscate.js';
export default apiHandler(async(req,res)=>{
 if(!publicCors(req,res))return;if(!method(req,res,['POST']))return;
 const b=body(req),action=String(b.action||'');
 if(action==='describe'){
  const link=await describeLink(String(b.token||''));return link?http(res,200,{ok:true,link}):error(res,404,'NOT_FOUND','Link tidak ditemukan.');
 }
 if(action==='claim'){
  const row=await claimLink(String(b.token||''),String(b.deviceId||''),String(b.proof||''));
  if(!row)return error(res,403,'CLAIM_DENIED','Link kedaluwarsa, telah diklaim browser lain, atau lisensi tidak aktif.');
  const session=credential(row);
  const source=obfuscateUserscript(adaptLegacyLicense(unseal(row.source_cipher),{session,deviceId:row.device_id,customer:row.customer,tool:row.tool_slug}));
  return http(res,200,{ok:true,package:{licenseId:row.license_id,deliveryId:row.id,tool:row.tool_slug,name:row.name,version:row.version,matches:row.matches,source,sourceHash:hash(source),session,deviceId:row.device_id,customer:row.customer,expiresAt:row.license_expires_at}});
 }
 if(action==='validate'){
  const r=await validateSession(String(b.session||''),String(b.deviceId||''),b.tool);
  return r?http(res,200,{ok:true,expiresAt:r.license_expires_at,customer:r.customer,tool:r.tool_slug}):error(res,403,'LICENSE_INACTIVE','Lisensi tidak aktif, dicabut, atau terikat pada browser lain.');
 }
 return error(res,400,'BAD_ACTION','Aksi tidak dikenal.');
});
