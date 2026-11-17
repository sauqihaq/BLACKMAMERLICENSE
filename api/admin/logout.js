import {apiHandler,method,http,error,checkAdminOrigin} from '../../lib/common.js';
import {setCookie} from '../../lib/auth.js';
export default apiHandler(async(req,res)=>{
  if(!method(req,res,['POST']))return;
  if(!checkAdminOrigin(req))return error(res,403,'CSRF_REJECTED','Permintaan lintas situs ditolak.');
  setCookie(res,'',req);http(res,200,{ok:true});
});
