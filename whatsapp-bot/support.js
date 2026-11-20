import {clean,validInstallLink} from './core.js';

export function installationGuide(site){
 const origin=new URL(site).origin;
 return [
  '*📖 PANDUAN INSTALASI BLACKMAMERSTUDIO*',
  '',
  '1️⃣ *Pasang extension BlackMamer di Chrome desktop*',
  'Buka: '+origin+'/extension',
  'Unduh file ZIP BlackMamer lalu ekstrak ke folder tetap di komputer.',
  '',
  '2️⃣ *Aktifkan extension*',
  'Buka chrome://extensions → nyalakan *Developer mode* → *Load unpacked* → pilih folder hasil ekstrak yang berisi manifest.json.',
  'Masuk *Details* pada BlackMamer dan aktifkan *Allow user scripts* jika tersedia.',
  '',
  '3️⃣ *Pasang BMscript*',
  'Buka link instalasi pribadi dari admin di browser Chrome yang *sama*.',
  'Pastikan halaman menunjukkan extension BlackMamer terhubung, lalu klik *Install BMscript*.',
  'Saat jendela konfirmasi di extension muncul, periksa produknya lalu tekan *Install*.',
  '',
  '4️⃣ *Mulai gunakan*',
  'Buka situs tujuan yang didukung sesuai daftar pada halaman instalasi.',
  '',
  '🔒 Jangan bagikan link privat. Lisensi akan terikat ke browser pertama yang mengklaimnya.',
  '💬 Jika perlu panduan ulang, ketik *PANDUAN*. Untuk bicara dengan admin, ketik *ADMIN*.'
 ].join('\n');
}
export function approvedMessage({orderId,installUrl,site}){
 if(!/^[a-f0-9]{8}$/i.test(String(orderId||'')))throw Error('Invalid order ID');
 if(validInstallLink(installUrl,site)!==installUrl)throw Error('Invalid install URL');
 return '✅ *PEMBAYARAN DISETUJUI*\n'+
  'Pesanan *'+String(orderId).toUpperCase()+'* disetujui admin. Terima kasih sudah order! 🎉\n\n'+
  '🔗 *LINK INSTALASI PRIBADI*\n'+installUrl+'\n\n'+installationGuide(site);
}
export function isSupportRequest(value){
 return /^(?:admin|bantuan|chat\s+admin|hubungi\s+admin)$/i.test(clean(value,90));
}
export function isSupportExit(value){
 return /^(?:selesai|keluar|tutup\s+chat)$/i.test(clean(value,90));
}
export function isGuideRequest(value){
 return /^(?:panduan|tutorial|cara\s+pasang)$/i.test(clean(value,90));
}
export function parseSupportAdminCommand(value){
 const input=clean(value,1600);
 if(/^!tickets$/i.test(input))return {op:'tickets'};
 const match=/^!(reply|close)\s+([a-f0-9]{8})(?:\s+([\s\S]+))?$/i.exec(input);
 if(!match)return null;
 const op=match[1].toLowerCase(),id=match[2].toUpperCase(),message=clean(match[3]||'',1200);
 if(op==='reply'&&!message)return null;
 if(op==='close'&&message)return null;
 return {op,id,...(op==='reply'?{message}:{})};
}
