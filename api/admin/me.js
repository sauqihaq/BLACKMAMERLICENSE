import {apiHandler,method,http} from '../../lib/common.js';
import {requireAdmin} from '../../lib/auth.js';
export default apiHandler(async(req,res)=>{
  if(!method(req,res,['GET']))return;
  if(!requireAdmin(req,res))return;
  http(res,200,{ok:true,username:process.env.ADMIN_USERNAME||'admin'});
});
