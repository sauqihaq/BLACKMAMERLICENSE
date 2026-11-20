import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import qrcode from 'qrcode-terminal';
import {Client} from './baileys-client.js';
import {createStore} from './store.js';
import {clean,formatRupiah,parseDuration,priceFor,matchProductFromWebsite,productBySlug,validInstallLink,parseAdminCommand,paymentCaption} from './core.js';

const site=String(process.env.WEBSITE_URL||'https://blackmamerlicense.vercel.app').replace(/\/$/,'');
const adminNumber=String(process.env.ADMIN_WA_NUMBER||'').replace(/\D/g,'');
if(!/^[1-9]\d{8,14}$/.test(adminNumber))throw Error('Set ADMIN_WA_NUMBER di .env dengan nomor admin terpisah, format 628xxx.');
const adminJid=adminNumber+'@c.us';
const qrPath=process.env.PAYMENT_QR_PATH?path.resolve(process.env.PAYMENT_QR_PATH):'';
const store=createStore(process.env.BOT_DATA_DIR||'./.bot-data');
// A distinct Baileys directory keeps old Chromium sessions untouched and untrusted.
const authDir=path.resolve(process.env.BAILEYS_AUTH_DIR||'./.baileys_auth');
const client=new Client({authDir});
let ready=false;
const recentIds=new Set();
const seen=id=>{
 if(!id)return false;
 if(recentIds.has(id))return true;
 recentIds.add(id);
 if(recentIds.size>2000)recentIds.delete(recentIds.values().next().value);
 return false;
};
async function catalog(){
 const response=await fetch(site+'/api/store',{signal:AbortSignal.timeout(12000),headers:{Accept:'application/json'}});
 if(!response.ok)throw Error('Website tidak tersedia ('+response.status+')');
 const info=await response.json();
 if(!info?.ok||!Array.isArray(info.catalog))throw Error('Katalog website tidak valid');
 return info.catalog;
}
const reply=(msg,text)=>msg.reply(text);
async function notifyAdmin(text){
 try{await client.sendMessage(adminJid,text);}catch(e){console.error('[ADMIN NOTIFICATION]',e.message);}
}
async function handleAdmin(msg){
 const cmd=parseAdminCommand(msg.body);
 if(!cmd)return;
 if(cmd.op==='help')return reply(msg,'*BLACKMAMERSTUDIO Admin*\n!orders — pesanan terakhir\n!approve ID URL — setujui setelah cek transfer dan terbitkan link di website\n!reject ID — tolak pembayaran.\nContoh: !approve A1B2C3D4 https://blackmamerlicense.vercel.app/install#token=...');
 if(cmd.op==='orders'){
  const last=store.all().slice(0,10);
  return reply(msg,last.length?last.map(o=>o.id+' | '+o.status+' | '+o.productName+' | '+o.days+' hari | '+formatRupiah(o.total||0)).join('\n'):'Belum ada pesanan.');
 }
 const order=store.get(cmd.id);
 if(!order)return reply(msg,'ID pesanan tidak ditemukan.');
 if(order.status!=='pending_review')return reply(msg,'Pesanan '+cmd.id+' belum siap ditinjau (status '+order.status+').');
 if(cmd.op==='reject'){
  store.update(order.id,{status:'rejected'});
  await client.sendMessage(order.jid,'Pembayaran untuk pesanan '+order.id+' belum dapat dikonfirmasi. Silakan hubungi admin BLACKMAMERSTUDIO.');
  return reply(msg,'Pesanan '+order.id+' ditolak.');
 }
 const url=validInstallLink(cmd.url,site);
 if(!url)return reply(msg,'Link harus URL install resmi '+site+'/install#token=... dari Admin Panel.');
 // No payment is verified by the bot. Only the configured admin can send the approval.
 // License must be issued manually in website Admin > Produk & Akses first.
 store.update(order.id,{status:'approved_sending',installUrl:url});
 try{
  await client.sendMessage(order.jid,'✅ Pembayaran pesanan '+order.id+' telah disetujui admin.\n\nLink instalasi BMscript BLACKMAMERSTUDIO:\n'+url+'\n\nLink ini privat. Jangan bagikan ke orang lain.');
  store.update(order.id,{status:'completed',deliveredAt:new Date().toISOString()});
  return reply(msg,'Berhasil: link pesanan '+order.id+' terkirim ke pelanggan.');
 }catch(e){
  store.update(order.id,{status:'pending_review',installUrl:null});
  return reply(msg,'Pengiriman gagal: '+clean(e.message,180)+'. Silakan ulangi perintah approve.');
 }
}
async function beginOrder(msg,p){
 const existing=store.forChat(msg.from);
 if(existing)return reply(msg,'Pesanan '+existing.id+' masih berjalan ('+existing.status+'). Selesaikan dulu pesanan tersebut.');
 const order=store.create({jid:msg.from,productSlug:p.product.slug,productName:p.product.name,customer:p.customer||'Pelanggan',days:null,total:null});
 return reply(msg,'Halo, selamat datang di *BLACKMAMERSTUDIO*! 👋\n\nProduk pilihan: *'+order.productName+'*\nID Pesanan: *'+order.id+'*\n\nMau beli lisensi untuk *berapa hari*?\n\nCukup balas dengan *angka saja*, misalnya *7*, *14*, atau *30*.\n\nSetelah itu, bot akan menghitung total harga dan mengirim QRIS pembayaran di chat ini.');
}
async function handleCustomer(msg){
 const body=clean(msg.body,1400);
 if(/^!(menu|produk)$/i.test(body)){
  const items=await catalog();
  return reply(msg,'*Katalog BMscript BLACKMAMERSTUDIO*\n'+items.map(x=>'• '+x.name+' ('+x.slug+') — '+(Number.isInteger(Number(x.price))?formatRupiah(Number(x.price))+'/hari':'Tanya admin')).join('\n')+'\n\nPesan dengan mengetik: !order slug');
 }
 if(/^!order\s+[a-z][a-z0-9-]{2,35}$/i.test(body)){
  const items=await catalog(),slug=body.split(/\s+/)[1].toLowerCase();
  const product=productBySlug(items,slug);
  if(!product)return reply(msg,'Produk tidak ditemukan. Ketik !menu.');
  return beginOrder(msg,{product,customer:clean(msg._data?.notifyName||'Pelanggan',100)});
 }
 // Existing wa.me checkout message is recognized without changing the website.
 if(/blackmamerstudio/i.test(body)&&/mau pesan/i.test(body)){
  const items=await catalog(),parsed=matchProductFromWebsite(body,items);
  if(parsed)return beginOrder(msg,{...parsed,customer:parsed.customer==='Pelanggan'?clean(msg._data?.notifyName||'Pelanggan',100):parsed.customer});
 }
 const current=store.forChat(msg.from);
 if(!current)return; // Never auto-reply to unrelated personal WhatsApp messages.
 if(current.status==='choose_duration'){
  const days=parseDuration(body);
  if(!days)return reply(msg,'Cukup ketik *angka jumlah hari* ya, misalnya *7*, *14*, atau *30* (minimal 1 hari, maksimal 3650 hari).');
  const items=await catalog(),product=productBySlug(items,current.productSlug);
  const total=priceFor(product,days);
  if(total===null)return reply(msg,'Harga produk belum diatur di website. Hubungi admin sebelum melakukan pembayaran.');
  const pricePerDay=Number(product.price);
  const caption=paymentCaption({id:current.id,productName:product.name,pricePerDay,days,total});
  store.update(current.id,{days,total,status:'awaiting_proof'});
  if(qrPath&&fs.existsSync(qrPath)){
   try{
    // Baileys sends the actual user-provided static QRIS photo with all details in one caption.
    await client.sendMessage(msg.from,{image:fs.readFileSync(qrPath),caption});
   }catch(e){
    console.error('[QRIS SEND ERROR]',e?.message||e);
    await reply(msg,'Maaf, gambar QRIS saat ini gagal dikirim. *Jangan transfer dulu.*\n\nPesanan: '+current.id+'\nTotal: *'+formatRupiah(total)+'*\n\nAdmin akan mengirim petunjuk pembayaran yang benar.');
    await notifyAdmin('⚠️ QRIS gagal dikirim ke pelanggan.\nPesanan: '+current.id+'\nTotal: '+formatRupiah(total)+'\nChat: '+msg.from+'\nPeriksa PAYMENT_QR_PATH dan kirim QRIS secara manual.');
   }
  }else{
   await reply(msg,'Pesanan *'+current.id+'* sudah dihitung.\nDurasi: *'+days+' hari*\nTotal: *'+formatRupiah(total)+'*\n\nQRIS sedang tidak tersedia. *Jangan transfer dulu.* Admin akan mengirim QRIS resmi ke chat ini.');
   await notifyAdmin('📌 QRIS belum terpasang di Wispbyte (PAYMENT_QR_PATH).\nPesanan: '+current.id+'\nProduk: '+product.name+'\nDurasi: '+days+' hari\nTotal: '+formatRupiah(total)+'\nChat pelanggan: '+msg.from);
  }
  return;
 }
 if(current.status==='awaiting_proof'){
  if(!msg.hasMedia)return reply(msg,'Kirim foto/screenshot bukti pembayaran (gambar atau PDF). Kalau belum membayar, tunggu instruksi admin.');
  const media=await msg.downloadMedia();
  if(!media||!(/^(image\/(?:jpeg|png|webp)|application\/pdf)$/i.test(media.mimetype||'')))return reply(msg,'Kirim bukti berupa foto JPG/PNG/WebP atau PDF.');
  if(Buffer.byteLength(media.data||'','base64')>5*1024*1024)return reply(msg,'Bukti terlalu besar. Maksimal 5 MB.');
  store.update(current.id,{status:'pending_review',proofAt:new Date().toISOString()});
  await notifyAdmin('🔔 *BUKTI PEMBAYARAN MENUNGGU KONFIRMASI*\nID: '+current.id+'\nProduk: '+current.productName+'\nPelanggan: '+current.customer+'\nDurasi: '+current.days+' hari\nTotal: '+formatRupiah(current.total)+'\nNomor: '+msg.from+'\n\nPeriksa mutasi rekening, lalu di website Admin > Produk & Akses terbitkan license sesuai pesanan. Kirim *!approve '+current.id+' URL_INSTALL* di chat admin ini. Jika tidak valid, kirim *!reject '+current.id+'*.');
  try{await msg.forward(adminJid);}catch(e){console.warn('[PROOF FORWARD]',e.message);await notifyAdmin('Bukti pesanan '+current.id+' gagal diteruskan otomatis; buka chat pelanggan untuk melihatnya.');}
  return reply(msg,'Bukti pembayaran untuk pesanan *'+current.id+'* diterima. Menunggu pemeriksaan transfer oleh admin. License belum aktif.');
 }
 return reply(msg,'Pesanan '+current.id+' sedang menunggu pemeriksaan admin. Jangan mengirim bukti berulang kali.');
}
let qrCount=0;
client.on('qr',qr=>{qrCount++;
 console.log('[WA QR] Menunggu scan. QR baru #'+qrCount+'. Jika sudah scan tetapi muncul QR lagi, login belum selesai.');
 console.log('\nScan QR menggunakan WhatsApp Business > Perangkat tertaut > Tautkan perangkat.');
 qrcode.generate(qr,{small:true});
});
client.on('authenticated',()=>console.log('[WA AUTHENTICATED] Sesi diterima. Menyiapkan WhatsApp Web...'));
client.on('loading_screen',(percent,message)=>console.log('[WA LOADING]',percent, String(message||'').slice(0,100)));
client.on('change_state',state=>console.log('[WA STATE]',state));
client.on('ready',()=>{ready=true;console.log('[BLACKMAMERSTUDIO] WhatsApp bot READY. Website:',site);});
client.on('auth_failure',m=>console.error('[WHATSAPP AUTH FAILED]',String(m).slice(0,300)));
client.on('disconnected',reason=>{ready=false;console.warn('[WHATSAPP DISCONNECTED]',reason);});
const healthTimer=setInterval(()=>{
 if(ready)return;
 const mem=Math.round(process.memoryUsage().rss/(1024*1024));
 console.log('[WA WAITING] Baileys belum READY; Node.js RSS '+mem+' MB (tanpa Chromium). Periksa koneksi Wispbyte dan QR terbaru.');
},60000);
healthTimer.unref?.();
client.on('message',msg=>{
 const id=msg?.id?._serialized;
 if(!ready||msg.fromMe||!(/@c\.us$|@lid$/.test(msg.from||''))||seen(id))return;
 const admin=msg.from===adminJid;
 Promise.resolve().then(()=>admin?handleAdmin(msg):handleCustomer(msg)).catch(e=>{
  console.error('[MESSAGE ERROR]',e.message);
  reply(msg,'Layanan BLACKMAMERSTUDIO sedang mengalami kendala. Coba lagi atau hubungi admin.').catch(()=>{});
 });
});
process.on('SIGINT',()=>client.destroy().finally(()=>process.exit(0)));
process.on('SIGTERM',()=>client.destroy().finally(()=>process.exit(0)));
console.log('[BLACKMAMERSTUDIO] Starting Baileys WhatsApp bot... Auth folder:',authDir);
await client.initialize();
