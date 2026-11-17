import {apiHandler,body,method,http,error,cleanName,allowedPlans,createId,newKey,keyHash,DEVICE_REGEX,publicLicense} from '../../lib/common.js';
import {requireAdmin} from '../../lib/auth.js';
import {setup,query,audit} from '../../lib/store.js';
import {isTool} from '../../lib/catalog.js';
import adminDelivery from '../../lib/routes/admin-delivery.js';
export default apiHandler(async(req,res)=>{
  if(req.query?.view==='delivery')return adminDelivery(req,res);
  if(!method(req,res,['GET','POST']))return;
  if(!requireAdmin(req,res,{mutate:req.method==='POST'}))return;
  await setup();
  if(req.method==='GET'){
    const limit=Math.min(500,Math.max(1,Number(req.query?.limit)||250));
    const offset=Math.max(0,Number(req.query?.offset)||0);
    const [total]=await query('SELECT COUNT(*)::int AS count FROM bm_tripo_licenses');
    const items=await query('SELECT * FROM bm_tripo_licenses ORDER BY created_at DESC LIMIT $1 OFFSET $2',[limit,offset]);
    return http(res,200,{ok:true,licenses:items.map(publicLicense),total:total.count,limit,offset});
  }
  const b=body(req);
  const customer=cleanName(b.customer,100);
  const tool=String(b.tool||'tripo');
  const plan=String(b.plan||'Personal');
  const deviceId=String(b.deviceId||'').trim();
  const days=b.days===null||b.days===''?null:Number(b.days);
  if(!customer||!isTool(tool)||!allowedPlans.includes(plan)|| (deviceId&&!DEVICE_REGEX.test(deviceId)) || (days!==null&&(!Number.isSafeInteger(days)||days<1||days>3650)))
    return error(res,400,'INVALID_INPUT','Nama, paket, Device ID, atau masa aktif tidak valid.');
  const key=newKey(tool);
  const id=createId();
  const expires=days===null?null:new Date(Date.now()+days*86400000).toISOString();
  const [r]=await query(`INSERT INTO bm_tripo_licenses(id,key_hash,key_tail,customer,plan,status,device_id,expires_at,tool_slug)
    VALUES($1,$2,$3,$4,$5,'active',$6,$7,$8) RETURNING *`,[id,keyHash(key),key.slice(-5),customer,plan,deviceId||null,expires,tool]);
  await audit({licenseId:id,type:'issued',keyTail:r.key_tail,description:`Admin membuat license ${tool} untuk ${customer}`,toolSlug:tool});
  http(res,201,{ok:true,key,license:publicLicense(r),warning:'License key hanya muncul sekali. Simpan sekarang.'});
});
