import {apiHandler,method,http} from '../../lib/common.js';
import {requireAdmin} from '../../lib/auth.js';
import {setup,query} from '../../lib/store.js';
export default apiHandler(async(req,res)=>{
  if(!method(req,res,['GET']))return;
  if(!requireAdmin(req,res))return;
  await setup();
  const limit=Math.min(500,Math.max(1,Number(req.query?.limit)||100));
  const rows=await query(`SELECT e.id,e.type,e.display_name,e.device_id,e.key_tail,e.description,
      e.created_at,l.customer,l.plan,l.key_tail AS license_key_tail
      FROM bm_tripo_events e LEFT JOIN bm_tripo_licenses l ON l.id=e.license_id
      ORDER BY e.id DESC LIMIT $1`,[limit]);
  http(res,200,{ok:true,events:rows});
});
