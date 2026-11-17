import { createHash, randomBytes, randomUUID } from 'node:crypto';

export const KEY_REGEX = /^BM-(?:TRIPO|MESHY|SKFTX|SKFMOD)-(?:[A-Z2-9]{5}-){3}[A-Z2-9]{5}$/;
export const DEVICE_REGEX = /^bmdev_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const KEY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const allowedPlans = ['Personal', 'Pro', 'Studio'];

export function keyHash(key) { return createHash('sha256').update(String(key).trim().toUpperCase()).digest('hex'); }
export function newKey(tool='tripo') {
  const chars=[];
  for (const byte of randomBytes(20)) chars.push(KEY_ALPHABET[byte % KEY_ALPHABET.length]);
  return 'BM-' + ({tripo:'TRIPO',meshy:'MESHY','sketchfab-textures':'SKFTX','sketchfab-model':'SKFMOD'}[tool]||'TRIPO') + '-' + Array.from({length:4},(_,i)=>chars.slice(i*5,i*5+5).join('')).join('-');
}
export function createId(){ return randomUUID(); }
export function cleanName(input,max=80) { return typeof input==='string' ? input.trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,max) : ''; }
export function statusOf(r) {
  if(r.status==='revoked') return 'revoked';
  if(r.expires_at && new Date(r.expires_at).getTime()<=Date.now()) return 'expired';
  return 'active';
}
export function publicLicense(r) {
  return {
    id:r.id, customer:r.customer, plan:r.plan, tool:r.tool_slug||'tripo',
    keyMasked:`BM-${({tripo:'TRIPO',meshy:'MESHY','sketchfab-textures':'SKFTX','sketchfab-model':'SKFMOD'}[r.tool_slug]||'TRIPO')}-••••-••••-••••-${r.key_tail}`,
    status:statusOf(r), deviceId:r.device_id, lastName:r.last_name,
    createdAt:r.created_at, activatedAt:r.activated_at, lastSeenAt:r.last_seen_at,
    expiresAt:r.expires_at, checkCount:Number(r.check_count||0)
  };
}
export function http(res,status,data,extra={}) {
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  for(const [k,v] of Object.entries(extra))res.setHeader(k,v);
  res.end(JSON.stringify(data));
}
export function error(res,status,code,message,extra={}) { return http(res,status,{ok:false,code,message},extra); }
export function body(req) {
  const raw=req.body;
  if(!raw || typeof raw!=='object' || Array.isArray(raw) || JSON.stringify(raw).length>8192)return {};
  return raw;
}
export function method(req,res,allowed){
  if(!allowed.includes(req.method)) {res.setHeader('Allow',allowed.join(', '));error(res,405,'METHOD_NOT_ALLOWED','Metode tidak diizinkan.');return false;}
  return true;
}
export function publicCors(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','OPTIONS, POST');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  res.setHeader('Vary','Origin');
  if(req.method==='OPTIONS'){res.statusCode=204;res.end();return false;}
  return true;
}
export function checkAdminOrigin(req){
  if(req.headers['x-bm-admin']!=='1')return false;
  const origin=req.headers.origin;
  if(!origin)return true; // Non-browser clients still require a valid authenticated session.
  try { const o=new URL(origin);return o.host===req.headers.host && ['https:','http:'].includes(o.protocol); }
  catch{return false;}
}
export function apiHandler(fn) {
  return async (req,res)=>{
    try {return await fn(req,res);}
    catch(e){
      console.error('[BM LICENSE API]',e?.message || 'Server error');
      if(!res.headersSent) return error(res,503,'SERVER_ERROR','Server/database belum siap. Cek DATABASE_URL dan konfigurasi admin di Vercel.');
    }
  };
}
export function publicDecision(row,deviceId,activation){
  if(!row)return {code:'INVALID_KEY',message:'License key tidak terdaftar.'};
  if(statusOf(row)==='revoked')return {code:'REVOKED',message:'License dinonaktifkan admin.'};
  if(statusOf(row)==='expired')return {code:'EXPIRED',message:'License sudah kedaluwarsa.'};
  if(row.device_id && row.device_id!==deviceId)return {code:'DEVICE_MISMATCH',message:'License sudah terikat ke browser lain. Hubungi admin untuk Reset Device.'};
  if(!activation && !row.device_id)return {code:'NOT_ACTIVATED',message:'Aktivasi license terlebih dahulu.'};
  return null;
}
