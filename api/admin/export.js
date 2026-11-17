import {apiHandler,method} from '../../lib/common.js';
import {requireAdmin} from '../../lib/auth.js';
import {setup,query} from '../../lib/store.js';
const csv=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,'\'$&').replace(/"/g,'""')+'"';
export default apiHandler(async(req,res)=>{
  if(!method(req,res,['GET']))return;
  if(!requireAdmin(req,res))return;
  await setup();
  const rows=await query('SELECT * FROM bm_tripo_licenses ORDER BY created_at DESC LIMIT 10000');
  const keys=['tool_slug','customer','plan','status','key_tail','device_id','last_name','activated_at','last_seen_at','expires_at','check_count','created_at'];
  const header=['Tool','Customer','Plan','Status','Key Tail','Device ID','User Name','First Activated','Last Seen','Expires','Checks','Created'];
  const data=[header.map(csv).join(','),...rows.map(r=>keys.map(k=>csv(r[k])).join(','))].join('\r\n');
  res.statusCode=200;res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Disposition','attachment; filename="blackmamer-tripo-licenses.csv"');res.end('\uFEFF'+data);
});
