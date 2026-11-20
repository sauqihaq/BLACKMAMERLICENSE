/**
 * Pure helpers for website-driven BLACKMAMERSTUDIO WA order flow.
 * Never derive the payable total from customer-supplied WhatsApp text.
 */
export const MAX_DAYS=3650;
export function clean(value,max=100){
 return String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max);
}
export function formatRupiah(n){
 return new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n);
}
export function parseDuration(message){
 const m=/^(?:durasi\s+)?(\d{1,4})\s*(?:hari)?$/i.exec(clean(message,50));
 if(!m)return null;
 const days=Number(m[1]);
 return Number.isSafeInteger(days)&&days>=1&&days<=MAX_DAYS?days:null;
}
export function priceFor(product,days){
 const value=Number(product?.price);
 if(!Number.isSafeInteger(days)||days<1||days>MAX_DAYS||!Number.isSafeInteger(value)||value<1000)
   return null;
 const total=value*days;
 return Number.isSafeInteger(total)?total:null;
}
/** QRIS message is always calculated from the trusted live website catalog, never customer text. */
export function paymentCaption({id,productName,pricePerDay,days,total}){
 const expected=priceFor({price:pricePerDay},days);
 if(expected===null||expected!==total)throw Error('Invalid QRIS payment amount');
 const safeName=clean(productName,120);
 const safeId=String(id||'').toUpperCase();
 if(!/^[A-F0-9]{8}$/.test(safeId)||!safeName)throw Error('Invalid order');
 return [
  '💳 *PEMBAYARAN QRIS BLACKMAMERSTUDIO*',
  '',
  'Silakan melakukan pembayaran melalui QRIS pada gambar ini.',
  '',
  '📦 Produk: *'+safeName+'*',
  '🧾 ID Pesanan: *'+safeId+'*',
  '📅 Durasi: *'+days+' hari*',
  '💵 Harga per hari: *'+formatRupiah(pricePerDay)+'*',
  '💰 *TOTAL PEMBAYARAN: '+formatRupiah(total)+'*',
  '',
  '✅ Setelah melakukan pembayaran, silakan *kirim screenshot bukti pembayaran ke chat ini*.',
  '',
  '🔍 Admin akan memeriksa dana yang masuk. License diproses setelah pembayaran dinyatakan valid.',
  '',
  '⚠️ Pastikan penerima QRIS adalah *BLACKMAMER STUDIO* dan masukkan nominal sesuai total di atas.'
 ].join('\n');
}
export function matchProductFromWebsite(message,catalog){
 const body=clean(message,1300).toLocaleLowerCase('id-ID');
 if(!body.includes('blackmamerstudio')||!body.includes('mau pesan'))return null;
 const products=[...(catalog||[])].filter(p=>p?.name&&p?.slug).sort((a,b)=>b.name.length-a.name.length);
 // Stable product code from the new website. Legacy name-only checkout still works.
 const code=/\bKode Produk:\s*([a-z][a-z0-9-]{2,35})\b/i.exec(body);
 const selected=code
  ?products.find(p=>p.slug===code[1].toLowerCase())
  :products.find(p=>body.includes('mau pesan '+String(p.name).toLocaleLowerCase('id-ID')+'.'));
 if(!selected)return null;
 const name=/\bNama:\s*([^\n.]+)\./i.exec(message);
 return {product:selected,customer:clean(name?.[1]||'Pelanggan',100)};
}
export function productBySlug(catalog,slug){
 return (catalog||[]).find(p=>p?.slug===String(slug).trim().toLowerCase())||null;
}
export function validInstallLink(raw,websiteUrl){
 try{
  const site=new URL(websiteUrl),url=new URL(String(raw));
  return url.protocol==='https:'&&url.origin===site.origin&&url.pathname==='/install'&&(/^#token=[a-f0-9]{64}$/i.test(url.hash))&&url.search===''?url.href:null;
 }catch{return null;}
}
export function parseAdminCommand(raw){
 const text=clean(raw,1400);
 const m=/^!(orders|help|approve|reject)\b\s*([\s\S]*)$/i.exec(text);
 if(!m)return null;
 const op=m[1].toLowerCase(),args=m[2].trim();
 if(op==='orders'||op==='help')return {op};
 if(op==='reject'){const x=/^([A-F0-9]{8})$/i.exec(args);return x?{op,id:x[1].toUpperCase()}:null;}
 const x=/^([A-F0-9]{8})\s+(https:\/\/\S+)$/i.exec(args);
 return x?{op,id:x[1].toUpperCase(),url:x[2]}:null;
}

/**
 * Only commands from the verified admin number use admin mode.
 * Admin's regular website orders and !menu must still enter the customer flow.
 */
export function shouldHandleAdmin(from,body,adminJid){
 return String(from)===String(adminJid)&&parseAdminCommand(body)!==null;
}
