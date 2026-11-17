import {apiHandler,body,method,http,error,cleanName} from '../common.js';
import {requireAdmin} from '../auth.js';
import {setup,query} from '../store.js';
import {CATALOG} from '../catalog.js';
export default apiHandler(async(req,res)=>{
  if(!method(req,res,['GET','POST']))return;
  if(!requireAdmin(req,res,{mutate:req.method==='POST'}))return;
  await setup();
  if(req.method==='GET'){
    const [settings]=await query('SELECT discord_url,whatsapp_number,contact_note,prices,updated_at FROM bm_store_settings WHERE id=1');
    return http(res,200,{ok:true,settings});
  }
  const b=body(req);
  const discordUrl=String(b.discordUrl||'').trim();
  const whatsappNumber=String(b.whatsappNumber||'').replace(/[^0-9]/g,'');
  const note=cleanName(b.note||'',160);
  if(discordUrl && (!/^https:\/\/(?:discord\.gg\/|discord\.com\/(?:invite\/|users\/)|discordapp\.com\/invite\/)[a-zA-Z0-9-]+\/?$/.test(discordUrl)||discordUrl.length>200))
    return error(res,400,'INVALID_DISCORD','Masukkan link Discord invite atau profil pengguna yang valid.');
  if(whatsappNumber && !/^[1-9][0-9]{7,14}$/.test(whatsappNumber))
    return error(res,400,'INVALID_WA','WhatsApp wajib menggunakan kode negara, contoh 62812xxxx.');
  const raw=b.prices||{};
  if(!raw || typeof raw!=='object' || Array.isArray(raw))return error(res,400,'BAD_PRICES','Harga tidak valid.');
  const prices={};
  for(const tool of CATALOG){
    const price=raw[tool.slug];
    if(price==null || price===''){prices[tool.slug]=null;continue;}
    const n=Number(price);
    if(!Number.isSafeInteger(n)||n<1000||n>100000000) return error(res,400,'BAD_PRICE','Harga harus Rp1.000–Rp100.000.000.');
    prices[tool.slug]=n;
  }
  const [settings]=await query(`UPDATE bm_store_settings
      SET discord_url=$1,whatsapp_number=$2,contact_note=$3,prices=$4::jsonb,updated_at=NOW()
      WHERE id=1 RETURNING discord_url,whatsapp_number,contact_note,prices,updated_at`,
    [discordUrl,whatsappNumber,note,JSON.stringify(prices)]);
  return http(res,200,{ok:true,settings});
});
