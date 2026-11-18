import {createHash,createHmac,randomBytes,randomUUID,createCipheriv,createDecipheriv,timingSafeEqual} from 'node:crypto';
import {query,setup} from './store.js';
import {DEVICE_REGEX,statusOf} from './common.js';
import {CATALOG} from './catalog.js';
import {newKey,keyHash,allowedPlans,cleanName} from './common.js';

export const TOKEN_RE=/^[a-f0-9]{64}$/;
export const SESSION_RE=/^BMSESSION-([A-F0-9]{32})-([A-F0-9]{64})$/;
export const hash=s=>createHash('sha256').update(s).digest('hex');
const secret=()=>{
 const s=process.env.SCRIPT_ENCRYPTION_KEY||process.env.ADMIN_SESSION_SECRET;
 if(!s||s.length<32)throw Error('A 32+ character SCRIPT_ENCRYPTION_KEY or ADMIN_SESSION_SECRET is required');
 return s;
};
export function seal(source){const iv=randomBytes(12),key=createHash('sha256').update('bm-source:'+secret()).digest(),c=createCipheriv('aes-256-gcm',key,iv);const data=Buffer.concat([c.update(source,'utf8'),c.final()]);return [iv,c.getAuthTag(),data].map(b=>b.toString('base64')).join('.');}
export function unseal(value){const [iv,tag,data]=value.split('.').map(s=>Buffer.from(s,'base64'));const d=createDecipheriv('aes-256-gcm',createHash('sha256').update('bm-source:'+secret()).digest(),iv);d.setAuthTag(tag);return Buffer.concat([d.update(data),d.final()]).toString('utf8');}
export function parseSource(source){
 if(typeof source!=='string'||Buffer.byteLength(source)>1024*1024)throw Error('Ukuran userscript maksimal 1 MB.');
 const m=source.match(/\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/);
 if(!m)throw Error('Metadata ==UserScript== tidak ditemukan.');
 const get=k=>[...m[1].matchAll(new RegExp('^\\s*//\\s*@'+k+'\\s+(.+)$','gm'))].map(x=>x[1].trim());
 const name=get('name')[0],matches=get('match');
 if(!name||name.length>120||!matches.length||matches.length>50)throw Error('Userscript wajib memiliki @name dan @match (maksimal 50).');
 if(matches.some(v=>v!=='<all_urls>'&&!/^(?:https?|\*|file):\/\/(?:\*|(?:\*\.)?[^/\s:]+(?::\d+)?|)\/[^\s]*$/.test(v)))throw Error('Format @match tidak valid.');
 return {name,version:(get('version')[0]||'1.0').slice(0,60),matches};
}
export function linkExpiry(value,now=Date.now()){
 const t=Date.parse(value);
 if(!Number.isFinite(t)||t<=now||t>now+365*86400000)throw Error('Pilih tanggal kedaluwarsa link di masa depan, maksimal 365 hari.');
 return new Date(t).toISOString();
}
export async function saveProduct(tool,source){
 await setup();
 const [product]=await query('SELECT slug FROM bm_products WHERE slug=$1 AND active=TRUE',[tool]);
 if(!product)throw Error('Produk tidak ditemukan atau dinonaktifkan.');
 const metadata=parseSource(source);
 const [row]=await query(`INSERT INTO bm_product_scripts(id,tool_slug,name,version,matches,source_cipher,source_hash,source_kind)
 VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,'uploaded') RETURNING id,tool_slug,name,version,matches,created_at`,[randomUUID(),tool,metadata.name,metadata.version,JSON.stringify(metadata.matches),seal(source),hash(source)]);
 return row;
}
export async function issueLink(licenseId,expiresAt){
 const expiry=linkExpiry(expiresAt),token=randomBytes(32).toString('hex');await setup();
 const [row]=await query(`INSERT INTO bm_install_links(id,license_id,script_id,token_hash,expires_at)
 SELECT $1,l.id,s.id,$2,$3::timestamptz FROM bm_tripo_licenses l
 JOIN LATERAL(SELECT id FROM bm_product_scripts WHERE tool_slug=l.tool_slug ORDER BY created_at DESC,id DESC LIMIT 1)s ON TRUE
 WHERE l.id=$4 AND l.status='active' AND (l.expires_at IS NULL OR l.expires_at>NOW())
 RETURNING id,expires_at`,[randomUUID(),hash(token),expiry,licenseId]);
 if(!row)throw Error('Lisensi tidak aktif atau script produk belum diunggah.');
 return {...row,token};
}

/** One product selection creates one license and its matching install link atomically. */
export async function issueAccess({tool,customer,plan='Personal',days=30,linkExpiresAt}){
 await setup();
 const name=cleanName(customer,100);
 if(!name||!allowedPlans.includes(plan))throw Error('Nama pelanggan atau paket tidak valid.');
 const lifetime=days==='lifetime',n=Number(days);
 if(!lifetime&&(!Number.isSafeInteger(n)||n<1||n>3650))throw Error('Masa aktif harus 1–3650 hari.');
 const expires=linkExpiry(linkExpiresAt),licenseId=randomUUID(),linkId=randomUUID();
 const token=randomBytes(32).toString('hex'),key=newKey(tool);
 const licenseExpiry=lifetime?null:new Date(Date.now()+n*86400000).toISOString();
 const [row]=await query(`WITH selected_script AS (
   SELECT s.id FROM bm_product_scripts s JOIN bm_products p ON p.slug=s.tool_slug
   WHERE s.tool_slug=$1 AND p.active=TRUE AND s.source_kind='uploaded' ORDER BY s.created_at DESC,s.id DESC LIMIT 1
 ), new_license AS (
   INSERT INTO bm_tripo_licenses(id,key_hash,key_tail,customer,plan,status,expires_at,tool_slug)
   SELECT $2,$3,$4,$5,$6,'active',$7::timestamptz,$1 FROM selected_script
   RETURNING id,customer,tool_slug,expires_at
 ), new_link AS (
   INSERT INTO bm_install_links(id,license_id,script_id,token_hash,expires_at)
   SELECT $8,l.id,s.id,$9,$10::timestamptz FROM new_license l CROSS JOIN selected_script s
   RETURNING id,license_id,expires_at
 )
 SELECT l.id AS license_id,l.customer,l.tool_slug,l.expires_at AS license_expires_at,
        d.id AS link_id,d.expires_at AS link_expires_at
 FROM new_license l JOIN new_link d ON d.license_id=l.id`,
 [tool,licenseId,keyHash(key),key.slice(-5),name,plan,licenseExpiry,linkId,hash(token),expires]);
 if(!row)throw Error('Upload userscript untuk produk ini sebelum membuat akses.');
 return {licenseId:row.license_id,tool:row.tool_slug,customer:row.customer,expiresAt:row.license_expires_at,
         linkId:row.link_id,linkExpiresAt:row.link_expires_at,token};
}

/** Adapt only the recognizable legacy Tripo license form to the installed session.
    Custom user sources are otherwise delivered untouched. */
export function adaptLegacyLicense(source,{session,deviceId,customer,tool}){
 if(tool!=='tripo'||!source.includes('bm_tripo_license_key_v1')||!source.includes('const licenseState = {'))return source;
 const d='deviceId: getDeviceId(),';
 const k="key: String(GM_getValue('bm_tripo_license_key_v1', '') || '').trim().toUpperCase(),";
 const n="displayName: String(GM_getValue('bm_tripo_display_name_v1', '') || '').trim(),";
 if(!source.includes(d)||!source.includes(k)||!source.includes(n))return source;
 return source.replace(d,'deviceId: '+JSON.stringify(deviceId)+',')
   .replace(k,'key: '+JSON.stringify(session)+',')
   .replace(n,'displayName: '+JSON.stringify(customer)+',');
}

export const CLAIM_SQL=`WITH locked AS MATERIALIZED (
 SELECT d.id FROM bm_install_links d WHERE d.token_hash=$1 AND NOT d.revoked
 AND ((d.claimed_at IS NULL AND d.expires_at>NOW()) OR (d.device_id=$2 AND d.claim_hash=$3)) FOR UPDATE
), bound AS (
 UPDATE bm_tripo_licenses l SET device_id=COALESCE(l.device_id,$2),activated_at=COALESCE(l.activated_at,NOW()),last_seen_at=NOW()
 FROM bm_install_links d,locked x WHERE d.id=x.id AND l.id=d.license_id
 AND l.status='active' AND (l.expires_at IS NULL OR l.expires_at>NOW()) AND (l.device_id IS NULL OR l.device_id=$2)
 RETURNING l.id
), claimed AS (
 UPDATE bm_install_links d SET claimed_at=COALESCE(d.claimed_at,NOW()),device_id=$2,claim_hash=$3
 FROM locked x,bound b WHERE d.id=x.id AND d.license_id=b.id
 RETURNING d.*
) SELECT d.*,l.customer,l.plan,l.tool_slug,l.expires_at AS license_expires_at,s.name,s.version,s.matches,s.source_cipher,s.source_hash
 FROM claimed d JOIN bm_tripo_licenses l ON l.id=d.license_id JOIN bm_product_scripts s ON s.id=d.script_id`;
export function credential(row){return 'BMSESSION-'+row.id.replaceAll('-','').toUpperCase()+'-'+createHmac('sha256',secret()).update([row.id,row.device_id,row.claim_hash].join(':')).digest('hex').toUpperCase();}
export function validCredential(value,row){const a=Buffer.from(String(value)),b=Buffer.from(credential(row));return a.length===b.length&&timingSafeEqual(a,b);}
export async function claimLink(token,deviceId,proof){
 if(!TOKEN_RE.test(token)||!DEVICE_REGEX.test(deviceId)||!TOKEN_RE.test(proof))return null;
 await setup();return (await query(CLAIM_SQL,[hash(token),deviceId,hash(proof)]))[0]||null;
}
export async function validateSession(session,deviceId,tool){
 const match=SESSION_RE.exec(String(session));if(!match||!DEVICE_REGEX.test(deviceId))return null;
 const id=match[1].replace(/^(........)(....)(....)(....)(............)$/,'$1-$2-$3-$4-$5').toLowerCase();
 await setup();
 const [r]=await query(`SELECT d.*,l.status,l.device_id AS license_device,l.expires_at AS license_expires_at,l.customer,l.plan,l.tool_slug
 FROM bm_install_links d JOIN bm_tripo_licenses l ON l.id=d.license_id WHERE d.id=$1`,[id]);
 if(!r||r.revoked||!r.claimed_at||r.device_id!==deviceId||r.license_device!==deviceId||r.status!=='active'||(r.license_expires_at&&new Date(r.license_expires_at)<=new Date())||(tool&&r.tool_slug!==tool)||!validCredential(session,r))return null;
 return r;
}
export async function describeLink(token){
 if(!TOKEN_RE.test(token))return null;await setup();
 const [r]=await query(`SELECT d.id,d.expires_at,d.claimed_at,d.revoked,l.status,l.expires_at AS license_expires_at,l.tool_slug,s.name,s.version,s.matches
 FROM bm_install_links d JOIN bm_tripo_licenses l ON l.id=d.license_id JOIN bm_product_scripts s ON s.id=d.script_id WHERE d.token_hash=$1`,[hash(token)]);
 if(!r)return null;
 return {id:r.id,name:r.name,version:r.version,matches:r.matches,tool:r.tool_slug,expiresAt:r.expires_at,licenseExpiresAt:r.license_expires_at,
 status:r.revoked||r.status!=='active'?'revoked':r.license_expires_at&&new Date(r.license_expires_at)<=new Date()?'expired':r.claimed_at?'claimed':new Date(r.expires_at)<=new Date()?'expired':'ready'};
}
