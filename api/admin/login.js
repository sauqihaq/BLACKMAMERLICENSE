import {apiHandler,body,method,http,error,checkAdminOrigin} from '../../lib/common.js';
import {configured,createSession,setCookie,checkLoginLimit,failedLogin,successfulLogin,credentialsOk} from '../../lib/auth.js';
export default apiHandler(async(req,res)=>{
  if(!method(req,res,['POST']))return;
  if(!checkAdminOrigin(req))return error(res,403,'CSRF_REJECTED','Permintaan lintas situs ditolak.');
  if(!configured())return error(res,503,'ADMIN_NOT_CONFIGURED','Database atau rahasia admin belum dikonfigurasi di Vercel.');
  const {key,blocked}=await checkLoginLimit(req);
  if(blocked)return error(res,429,'RATE_LIMIT','Terlalu banyak percobaan. Coba lagi setelah 15 menit.');
  const b=body(req);
  const username=String(b.username||'').slice(0,100), password=String(b.password||'').slice(0,400);
  if(!credentialsOk(username,password)){
    await failedLogin(key);return error(res,401,'BAD_CREDENTIALS','Username atau password salah.');
  }
  await successfulLogin(key);
  setCookie(res,createSession(username),req);
  http(res,200,{ok:true,username,expiresInSeconds:28800});
});
