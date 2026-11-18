import {apiHandler,body,method,http,error,cleanName} from '../common.js';
import {requireAdmin} from '../auth.js';
import {setup,query} from '../store.js';
import {CATALOG} from '../catalog.js';
import {normalizeWhatsAppNumber} from '../whatsapp.js';
import {calculatePrice,effectiveDiscount} from '../pricing.js';
export default apiHandler(async(req,res)=>{
  if(!method(req,res,['GET','POST']))return;
  if(!requireAdmin(req,res,{mutate:req.method==='POST'}))return;
  await setup();
  if(req.method==='GET'){
    const [settings]=await query('SELECT discord_url,whatsapp_number,contact_note,prices,updated_at FROM bm_store_settings WHERE id=1');
    const products=await query('SELECT slug,name,description,image,price_daily,discount_percent,discount_until,active FROM bm_products ORDER BY created_at ASC,slug ASC');
    return http(res,200,{ok:true,settings,products});
  }
  const b=body(req);
  const discordUrl=String(b.discordUrl||'').trim();
  const whatsappNumber=normalizeWhatsAppNumber(b.whatsappNumber);
  const note=cleanName(b.note||'',160);
  if(discordUrl && (!/^https:\/\/(?:discord\.gg\/|discord\.com\/(?:invite\/|users\/)|discordapp\.com\/invite\/)[a-zA-Z0-9-]+\/?$/.test(discordUrl)||discordUrl.length>200))
    return error(res,400,'INVALID_DISCORD','Masukkan link Discord invite atau profil pengguna yang valid.');
  if(whatsappNumber===null)
    return error(res,400,'INVALID_WA','Isi nomor WhatsApp 628..., 08..., atau URL https://wa.me/628... yang valid.');
  const raw=b.prices||{};
  if(!raw || typeof raw!=='object' || Array.isArray(raw))return error(res,400,'BAD_PRICES','Harga tidak valid.');
  const prices={};
  const products=await query('SELECT slug FROM bm_products');
  for(const tool of products){
    const price=raw[tool.slug];
    if(price==null || price===''){prices[tool.slug]=null;continue;}
    const n=Number(price);
    if(!Number.isSafeInteger(n)||n<1000||n>100000000) return error(res,400,'BAD_PRICE','Harga harus Rp1.000–Rp100.000.000.');
    prices[tool.slug]=n;
  }
  // Legacy clients may omit discounts: preserve existing promo settings.
  const hasDiscounts=Object.prototype.hasOwnProperty.call(b,'discounts');
  const discounts={};
  if(hasDiscounts){
    if(!b.discounts||typeof b.discounts!=='object'||Array.isArray(b.discounts))
      return error(res,400,'INVALID_DISCOUNTS','Pengaturan diskon tidak valid.');
    const now=Date.now();
    for(const p of products){
      const input=b.discounts[p.slug]??{};
      if(!input||typeof input!=='object'||Array.isArray(input))
        return error(res,400,'INVALID_DISCOUNT','Diskon produk harus berupa object.');
      const rawPercent=input.percent??0;
      const rate=Number(rawPercent);
      if(!Number.isInteger(rate)||rate<0||rate>90)
        return error(res,400,'INVALID_DISCOUNT','Diskon harus angka bulat 0–90%.');
      let endsAt=null;
      if(rate>0&&input.endsAt){
        const date=new Date(input.endsAt);
        if(!Number.isFinite(date.getTime())||date.getTime()<=now)
          return error(res,400,'INVALID_DISCOUNT_END','Tanggal akhir promo harus valid dan masih di masa depan.');
        endsAt=date.toISOString();
      }
      if(rate>0&&prices[p.slug]==null)
        return error(res,400,'DISCOUNT_REQUIRES_PRICE','Isi harga normal sebelum menyalakan diskon.');
      discounts[p.slug]={percent:rate,endsAt:rate?endsAt:null};
    }
  }
  const [settings]=await query(`UPDATE bm_store_settings
      SET discord_url=$1,whatsapp_number=$2,contact_note=$3,prices=$4::jsonb,updated_at=NOW()
      WHERE id=1 RETURNING discord_url,whatsapp_number,contact_note,prices,updated_at`,
    [discordUrl,whatsappNumber,note,JSON.stringify(prices)]);
  for(const p of products){
    const discount=discounts[p.slug];
    if(hasDiscounts){
      await query('UPDATE bm_products SET price_daily=$2,discount_percent=$3,discount_until=$4::timestamptz WHERE slug=$1',
        [p.slug,prices[p.slug],discount.percent,discount.endsAt]);
    }else{
      await query('UPDATE bm_products SET price_daily=$2 WHERE slug=$1',[p.slug,prices[p.slug]]);
    }
  }
  return http(res,200,{ok:true,settings});
});
