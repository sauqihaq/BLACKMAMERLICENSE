import {apiHandler,method,http} from '../../lib/common.js';
import {requireAdmin} from '../../lib/auth.js';
import {setup,query} from '../../lib/store.js';
import adminStoreRoute from '../../lib/routes/admin-store.js';
export default apiHandler(async(req,res)=>{
  if(req.query?.view==='store')return adminStoreRoute(req,res);
  if(!method(req,res,['GET']))return;
  if(!requireAdmin(req,res))return;
  await setup();
  const [s]=await query(`SELECT COUNT(*)::int AS total,
    COUNT(*) FILTER(WHERE status='active' AND (expires_at IS NULL OR expires_at>NOW()))::int AS active,
    COUNT(*) FILTER(WHERE status='revoked')::int AS revoked,
    COUNT(*) FILTER(WHERE status='active' AND expires_at<=NOW())::int AS expired,
    COUNT(*) FILTER(WHERE device_id IS NOT NULL)::int AS devices,
    COUNT(*) FILTER(WHERE last_seen_at>NOW()-INTERVAL '24 hours')::int AS online24h,
    COALESCE(SUM(check_count),0)::bigint AS checks
    FROM bm_tripo_licenses`);
  const [t]=await query(`SELECT COUNT(*)::int AS blocked24h FROM bm_tripo_events
    WHERE type='rejected' AND created_at>NOW()-INTERVAL '24 hours'`);
  http(res,200,{ok:true,summary:{...s,checks:Number(s.checks),blocked24h:t.blocked24h}});
});
