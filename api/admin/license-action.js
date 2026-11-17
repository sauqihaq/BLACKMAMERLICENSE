import {apiHandler,body,method,http,error,cleanName,DEVICE_REGEX,publicLicense} from '../../lib/common.js';
import {requireAdmin} from '../../lib/auth.js';
import {setup,query,audit} from '../../lib/store.js';
const ACTIONS=['revoke','restore','reset-device','bind-device','set-expiry','rename','set-plan'];
export default apiHandler(async(req,res)=>{
  if(!method(req,res,['POST']))return;
  if(!requireAdmin(req,res,{mutate:true}))return;
  await setup();
  const b=body(req), id=String(b.id||'');
  const action=String(b.action||'');
  if(!/^[0-9a-f-]{36}$/i.test(id)||!ACTIONS.includes(action))return error(res,400,'INVALID_INPUT','ID atau aksi tidak valid.');
  let values=[id],updates=[];
  switch(action){
    case 'revoke': updates=["status='revoked'"];break;
    case 'restore': updates=["status='active'"];break;
    case 'reset-device': updates=['device_id=NULL','activated_at=NULL','last_name=NULL'];break;
    case 'bind-device':{
      const did=String(b.deviceId||'').trim();if(!DEVICE_REGEX.test(did))return error(res,400,'BAD_DEVICE','Device ID tidak valid.');
      values.push(did);updates=['device_id=$2','activated_at=NULL','last_name=NULL'];break;}
    case 'set-expiry':{
      const d=b.days===null?null:Number(b.days);
      if(d!==null&&(!Number.isSafeInteger(d)||d<1||d>3650))return error(res,400,'BAD_EXPIRY','Hari 1–3650 atau Lifetime.');
      values.push(d===null?null:new Date(Date.now()+d*86400000).toISOString());updates=['expires_at=$2'];break;}
    case 'rename':{
      const customer=cleanName(b.customer,100);if(!customer)return error(res,400,'BAD_NAME','Nama pelanggan wajib diisi.');
      values.push(customer);updates=['customer=$2'];break;}
    case 'set-plan':{
      const plan=String(b.plan||'');if(!['Personal','Pro','Studio'].includes(plan))return error(res,400,'BAD_PLAN','Paket tidak dikenal.');
      values.push(plan);updates=['plan=$2'];break;}
  }
  const [row]=await query(`UPDATE bm_tripo_licenses SET ${updates.join(',')},updated_at=NOW() WHERE id=$1 RETURNING *`,values);
  if(!row)return error(res,404,'NOT_FOUND','License tidak ditemukan.');
  await audit({licenseId:id,type:'admin_update',deviceId:row.device_id,keyTail:row.key_tail,description:action});
  http(res,200,{ok:true,license:publicLicense(row)});
});
