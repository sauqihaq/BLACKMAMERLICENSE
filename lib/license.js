import {KEY_REGEX,DEVICE_REGEX,cleanName,keyHash,publicDecision,body,publicCors,method,http,error,apiHandler} from './common.js';
import {setup,query,audit} from './store.js';

export const licenseRoute = activation => apiHandler(async(req,res)=>{
  if(!publicCors(req,res))return;
  if(!method(req,res,['POST']))return;
  const input=body(req);
  const key=String(input.key||'').trim().toUpperCase();
  const deviceId=String(input.deviceId||'');
  const displayName=cleanName(input.displayName,80)||'Pengguna tanpa nama';
  const action=['download','convert','open'].includes(input.action)?input.action:'check';
  if(!KEY_REGEX.test(key)||!DEVICE_REGEX.test(deviceId))return error(res,400,'INVALID_INPUT','Format license key atau Device ID salah.');
  await setup();
  const hash=keyHash(key);
  let rows=[];
  if(activation){
    // Atomic first-use binding. The first device wins when multiple activations race.
    rows=await query(`UPDATE bm_tripo_licenses SET
      device_id=COALESCE(device_id,$2), last_name=$3,
      activated_at=COALESCE(activated_at,NOW()),last_seen_at=NOW(),
      updated_at=NOW(),check_count=check_count+1
      WHERE key_hash=$1 AND status='active' AND (expires_at IS NULL OR expires_at>NOW())
      AND (device_id IS NULL OR device_id=$2)
      RETURNING *`,[hash,deviceId,displayName]);
  } else {
    rows=await query(`UPDATE bm_tripo_licenses SET
      last_name=$3,last_seen_at=NOW(),check_count=check_count+1
      WHERE key_hash=$1 AND status='active' AND (expires_at IS NULL OR expires_at>NOW())
      AND device_id=$2
      RETURNING *`,[hash,deviceId,displayName]);
  }
  const row=rows[0];
  if(row){
    if(activation)await audit({licenseId:row.id,type:'activated',displayName,deviceId,keyTail:row.key_tail,description:'License diterima dari browser'});
    else if(action==='download'||action==='convert')
      await audit({licenseId:row.id,type:action,displayName,deviceId,keyTail:row.key_tail,description:action==='download'?'Pengguna menekan fitur download':'Pengguna memulai konversi lokal'});
    else await query(`INSERT INTO bm_tripo_events(license_id,type,display_name,device_id,key_tail,description)
      SELECT $1,'checked',$2,$3,$4,'Verifikasi online berhasil'
      WHERE NOT EXISTS (SELECT 1 FROM bm_tripo_events WHERE license_id=$1 AND type='checked' AND created_at>NOW()-INTERVAL '1 hour')`,[row.id,displayName,deviceId,row.key_tail]);
    return http(res,200,{ok:true,code:'ACTIVE',message:'License aktif.',expiresAt:row.expires_at,customer:row.customer,plan:row.plan,displayName,deviceId});
  }
  const [found]=await query('SELECT * FROM bm_tripo_licenses WHERE key_hash=$1',[hash]);
  const reason=publicDecision(found,deviceId,activation)||{code:'BLOCKED',message:'License tidak dapat digunakan.'};
  await audit({licenseId:found?.id||null,type:'rejected',displayName,deviceId,keyTail:key.slice(-5),description:reason.code});
  return error(res,403,reason.code,reason.message);
});
