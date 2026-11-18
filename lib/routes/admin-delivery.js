import {apiHandler,method,body,http,error} from '../common.js';
import {requireAdmin} from '../auth.js';
import {query,setup,audit} from '../store.js';
import {issueLink,saveProduct,issueAccess} from '../delivery.js';
import {CATALOG} from '../catalog.js';
import {cleanName} from '../common.js';
export default apiHandler(async(req,res)=>{
 if(!method(req,res,['GET','POST']))return;
 if(!requireAdmin(req,res,{mutate:req.method==='POST'}))return;await setup();
 if(req.method==='GET'){
  const products=await query('SELECT * FROM bm_products ORDER BY created_at ASC,slug ASC');
  const scripts=await query(`SELECT DISTINCT ON(tool_slug) id,tool_slug,name,version,matches,created_at FROM bm_product_scripts WHERE source_kind='uploaded' ORDER BY tool_slug,created_at DESC,id DESC`);
  const links=await query(`SELECT d.id,d.license_id,d.expires_at,d.claimed_at,d.revoked,d.created_at,l.customer,l.tool_slug,s.name,s.version
   FROM bm_install_links d JOIN bm_tripo_licenses l ON l.id=d.license_id JOIN bm_product_scripts s ON s.id=d.script_id ORDER BY d.created_at DESC LIMIT 100`);
  return http(res,200,{ok:true,products,scripts,links});
 }
 // Only authenticated admin may upload code; use a separate bounded payload limit.
 const b=req.body;if(!b||typeof b!=='object'||Array.isArray(b)||JSON.stringify(b).length>1500000)return error(res,400,'BAD_INPUT','Payload tidak valid atau terlalu besar.');
 try{
  if(b.action==='create-product'){
    const name=cleanName(b.name,120),slug=String(b.slug||'').trim().toLowerCase();
    if(!name||name.length<2||!/^[a-z][a-z0-9-]{2,35}$/.test(slug))
      throw Error('Nama / slug harus 3–36 karakter kecil, angka, atau tanda minus.');
    const description=cleanName(b.description,500);
    const image=String(b.image||'/assets/tripo.svg');
    if(!CATALOG.some(p=>p.image===image))throw Error('Gambar produk tidak valid.');
    const [product]=await query(`INSERT INTO bm_products(slug,name,eyebrow,description,image,features)
      VALUES($1,$2,'YOUR TOOL',$3,$4,'[]'::jsonb) ON CONFLICT(slug) DO NOTHING RETURNING slug,name`,
      [slug,name,description,image]);
    if(!product)throw Error('Slug sudah dipakai. Pilih produk itu dari daftar, atau gunakan nama lain.');
    return http(res,201,{ok:true,product});
  }
  if(b.action==='set-product'){
    const [p]=await query('UPDATE bm_products SET active=$2 WHERE slug=$1 RETURNING slug,active',[String(b.tool||''),b.active===true]);
    return p?http(res,200,{ok:true,product:p}):error(res,404,'NO_PRODUCT','Produk tidak ditemukan.');
  }
  if(b.action==='upload'){
    const script=await saveProduct(String(b.tool||''),String(b.source||''));
    return http(res,201,{ok:true,script});
  }
  if(b.action==='issue-access'){
    const access=await issueAccess({tool:String(b.tool||''),customer:b.customer,plan:b.plan||'Personal',days:b.days,linkExpiresAt:b.expiresAt});
    await audit({licenseId:access.licenseId,type:'issued',description:'Akses otomatis untuk '+access.tool,toolSlug:access.tool});
    await audit({licenseId:access.licenseId,type:'install_link',description:'Admin menerbitkan link install '+access.customer,toolSlug:access.tool});
    return http(res,201,{ok:true,access:{licenseId:access.licenseId,tool:access.tool,customer:access.customer,expiresAt:access.expiresAt,
      link:{id:access.linkId,expiresAt:access.linkExpiresAt,path:'/install#token='+access.token}}});
  }
  if(b.action==='issue'){
   if(!/^[0-9a-f-]{36}$/i.test(b.licenseId||''))throw Error('Pilih lisensi.');
   const issued=await issueLink(b.licenseId,b.expiresAt);
   await audit({licenseId:b.licenseId,type:'install_link',description:'Link install dibuat oleh admin'});
   return http(res,201,{ok:true,link:{id:issued.id,expiresAt:issued.expires_at,path:'/install#token='+issued.token}});
  }
  if(b.action==='revoke-link'){
   if(!/^[0-9a-f-]{36}$/i.test(b.id||''))throw Error('ID link tidak valid.');
   const [r]=await query('UPDATE bm_install_links SET revoked=TRUE WHERE id=$1 RETURNING id',[b.id]);
   return r?http(res,200,{ok:true}):error(res,404,'NOT_FOUND','Link tidak ditemukan.');
  }
  return error(res,400,'BAD_ACTION','Aksi tidak dikenal.');
 }catch(e){if(e.message?.includes('database')||e.code)throw e;return error(res,400,'INVALID_INPUT',e.message);}
});
