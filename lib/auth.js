import {createHmac,createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {error,checkAdminOrigin} from './common.js';
import {query,setup} from './store.js';
const COOKIE='bm_admin_session';
const TTL=8*60*60;
const now=()=>Math.floor(Date.now()/1000);
const digest=s=>createHash('sha256').update(s).digest();
const equal=(a,b)=>timingSafeEqual(digest(String(a)),digest(String(b)));
const secret=()=>process.env.ADMIN_SESSION_SECRET||'';
export function configured(){return !!process.env.DATABASE_URL && !!(process.env.ADMIN_PASSWORD?.length>=12) && secret().length>=32;}
function signature(data){return createHmac('sha256',secret()).update(data).digest('base64url');}
export function createSession(username){
  const data=Buffer.from(JSON.stringify({u:username,iat:now(),exp:now()+TTL,n:randomBytes(16).toString('hex')})).toString('base64url');
  return `${data}.${signature(data)}`;
}
export function verifySession(token){
  if(!configured()||!token||typeof token!=='string')return false;
  const parts=token.split('.');
  if(parts.length!==2||parts[0].length>2048)return false;
  if(!equal(parts[1],signature(parts[0])))return false;
  try{const p=JSON.parse(Buffer.from(parts[0],'base64url').toString());return p.u===(process.env.ADMIN_USERNAME||'admin') && Number.isFinite(p.exp) && p.exp>now() && p.iat<=now()+60;}
  catch{return false;}
}
export function readCookie(req){
  const raw=String(req.headers.cookie||'').split('; ').find(x=>x.startsWith(COOKIE+'='));
  return raw?raw.slice(COOKIE.length+1):'';
}
export function setCookie(res,token,req){
  const secure=(req.headers['x-forwarded-proto']==='https'||process.env.VERCEL==='1'||process.env.NODE_ENV==='production')?'; Secure':'';
  res.setHeader('Set-Cookie',`${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${token?TTL:0}${secure}`);
}
export function requireAdmin(req,res,{mutate=false}={}){
  if(!configured()){error(res,503,'ADMIN_NOT_CONFIGURED','Set ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_SESSION_SECRET, dan DATABASE_URL di Vercel.');return false;}
  if(mutate&&!checkAdminOrigin(req)){error(res,403,'CSRF_REJECTED','Permintaan lintas situs ditolak.');return false;}
  if(!verifySession(readCookie(req))){error(res,401,'UNAUTHORIZED','Sesi admin habis atau belum login.');return false;}
  return true;
}
export async function checkLoginLimit(req){
  await setup();
  const key=createHash('sha256').update(String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0]).digest('hex');
  const r=(await query('SELECT failures,locked_until FROM bm_tripo_admin_attempts WHERE ip_hash=$1',[key]))[0];
  return {key, blocked:!!(r?.locked_until&&new Date(r.locked_until).getTime()>Date.now())};
}
export async function failedLogin(key){
  await query(`INSERT INTO bm_tripo_admin_attempts(ip_hash,failures,window_start,locked_until)
    VALUES($1,1,NOW(),NULL)
    ON CONFLICT(ip_hash) DO UPDATE SET
    failures=CASE WHEN bm_tripo_admin_attempts.window_start<NOW()-INTERVAL '15 minutes' THEN 1 ELSE bm_tripo_admin_attempts.failures+1 END,
    window_start=CASE WHEN bm_tripo_admin_attempts.window_start<NOW()-INTERVAL '15 minutes' THEN NOW() ELSE bm_tripo_admin_attempts.window_start END,
    locked_until=CASE WHEN bm_tripo_admin_attempts.window_start<NOW()-INTERVAL '15 minutes' THEN NULL WHEN bm_tripo_admin_attempts.failures+1>=8 THEN NOW()+INTERVAL '15 minutes' ELSE bm_tripo_admin_attempts.locked_until END`,[key]);
}
export async function successfulLogin(key){await query('DELETE FROM bm_tripo_admin_attempts WHERE ip_hash=$1',[key]);}
export function credentialsOk(username,password){return equal(username,process.env.ADMIN_USERNAME||'admin')&&equal(password,process.env.ADMIN_PASSWORD||'');}
