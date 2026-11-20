import test from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {parseDuration,priceFor,matchProductFromWebsite,productBySlug,validInstallLink,parseAdminCommand,paymentCaption,shouldHandleAdmin} from '../whatsapp-bot/core.js';
const site='https://blackmamerlicense.vercel.app';
const catalog=[{name:'Tripo3D Studio',slug:'tripo',price:12000},{name:'BLACKMAMERSTUDIO | Model Tools SILVER',slug:'sketchfab-model',price:18000}];
test('website checkout is read from trusted dynamic catalog, never from customer price text',()=>{
 const p=matchProductFromWebsite('Halo admin BLACKMAMERSTUDIO, saya mau pesan Tripo3D Studio. Harga: Rp1. Nama: Budi. Mohon info pembayaran.',catalog);
 assert.equal(p.product.slug,'tripo');assert.equal(p.customer,'Budi');
 assert.equal(priceFor(p.product,7),84000);
 assert.equal(priceFor(p.product,0),null);
 assert.equal(priceFor({price:null},7),null);
 assert.equal(priceFor({price:undefined},7),null);
 assert.equal(matchProductFromWebsite('Halo admin, saya mau pesan Tripo3D Studio.',catalog),null);
 assert.equal(productBySlug(catalog,'tripo').slug,'tripo');
});
test('durations are bounded and untrusted chats cannot trigger license approval',()=>{
 assert.equal(parseDuration('DURASI 7'),7);
 assert.equal(parseDuration('30 hari'),30);
 assert.equal(parseDuration('durasi 9999'),null);
 assert.equal(parseDuration('durasi -4'),null);
 assert.equal(parseAdminCommand('!approve 12345678 https://blackmamerlicense.vercel.app/install#token='+'a'.repeat(64)).op,'approve');
 assert.equal(parseAdminCommand('!reject 12345678').op,'reject');
 assert.equal(parseAdminCommand('!approve invalid'),null);
});
test('license link only accepted on verified origin, path and token format',()=>{
 const good=site+'/install#token='+'a'.repeat(64);
 assert.equal(validInstallLink(good,site),good);
 assert.equal(validInstallLink('https://evil.example/install#token='+'a'.repeat(64),site),null);
 assert.equal(validInstallLink(site+'/other?token='+'a'.repeat(64),site),null);
 assert.equal(validInstallLink(site+'/install#token=1234',site),null);
 assert.equal(validInstallLink('javascript:alert(1)',site),null);
});

test('Baileys replaces Chromium and Puppeteer in the deployment package',()=>{
 const pkg=JSON.parse(readFileSync(new URL('../whatsapp-bot/package.json',import.meta.url),'utf8'));
 assert.ok(pkg.dependencies['@whiskeysockets/baileys']);
 assert.ok(!pkg.dependencies['whatsapp-web.js']);
 assert.ok(!pkg.scripts.postinstall);
 assert.ok(!pkg.dependencies.puppeteer);
});


test('Baileys socket diagnostics, QR and messages are handled in the adapter',()=>{
 const source=readFileSync(new URL('../whatsapp-bot/baileys-client.js',import.meta.url),'utf8');
 assert.match(source,/connection\.update/);
 assert.match(source,/messages\.upsert/);
 assert.match(source,/creds\.update/);
 assert.match(source,/useMultiFileAuthState/);
 assert.match(source,/downloadContentFromMessage/);
 assert.match(source,/DisconnectReason\.loggedOut/);
});

import {incomingChatId,outgoingJid,personalJid,messageText,attachment} from '../whatsapp-bot/baileys-message.js';
test('JID conversion supports PN, LID and refuses group/admin impersonation',()=>{
 assert.equal(outgoingJid('6281383919823@c.us'),'6281383919823@s.whatsapp.net');
 assert.equal(outgoingJid('123456789@lid'),'123456789@lid');
 assert.throws(()=>outgoingJid('customer@g.us'));
 assert.equal(incomingChatId({remoteJid:'123456789@lid',remoteJidAlt:'6281383919823@s.whatsapp.net'}),'6281383919823@c.us');
 assert.equal(incomingChatId({remoteJid:'123456789@lid'},'6281383919823@s.whatsapp.net'),'6281383919823@c.us');
 assert.equal(incomingChatId({remoteJid:'123456789@lid'}),'123456789@lid');
 assert.equal(incomingChatId({remoteJid:'group@g.us'}),null);
 assert.equal(personalJid('123456789@lid'),true);
 assert.equal(personalJid('group@g.us'),false);
});
test('text and media extraction unwrap ephemeral messages and captures',()=>{
 const wrapper={ephemeralMessage:{message:{imageMessage:{mimetype:'image/png',caption:'Bukti transfer'}}}};
 assert.equal(messageText(wrapper),'Bukti transfer');
 assert.equal(attachment(wrapper).type,'image');
 assert.equal(attachment({documentMessage:{mimetype:'application/pdf'}}).type,'document');
 assert.equal(attachment({conversation:'Hi'}),null);
});

test('website order with stable product slug survives product display-name changes',()=>{
 const message='Halo BLACKMAMERSTUDIO, saya mau pesan Tripo3D Studio. Kode Produk: tripo. Harga: Rp1. Nama: Pelanggan. Mohon konfirmasi durasi lisensi.';
 const catalogAfterRename=[{name:'Tripo3D Studio PRO',slug:'tripo',price:12000}];
 assert.equal(matchProductFromWebsite(message,catalogAfterRename)?.product.slug,'tripo');
 assert.equal(matchProductFromWebsite(message,catalog)?.customer,'Pelanggan');
 assert.equal(matchProductFromWebsite(message.replace('Kode Produk: tripo','Kode Produk: invalid-tool'),catalog),null);
 assert.equal(priceFor(catalogAfterRename[0],14),168000);
});


test('QRIS caption computes live-catalog price times duration with screenshot instructions',()=>{
 const data={id:'A1B2C3D4',productName:'Tripo3D Studio',pricePerDay:12000,days:30,total:360000};
 const message=paymentCaption(data);
 assert.match(message,/Tripo3D Studio/);
 assert.match(message,/A1B2C3D4/);
 assert.match(message,/30 hari/);
 assert.match(message,/Rp\s?12\.000/);
 assert.match(message,/Rp\s?360\.000/);
 assert.match(message,/screenshot bukti pembayaran ke chat ini/);
 assert.match(message,/BLACKMAMER STUDIO/);
 assert.throws(()=>paymentCaption({...data,total:1000}),/Invalid QRIS payment amount/);
 assert.throws(()=>paymentCaption({...data,days:0,total:0}),/Invalid QRIS payment amount/);
});
test('Baileys sends original QRIS image plus complete caption and keeps manual verification',()=>{
 const index=readFileSync(new URL('../whatsapp-bot/index.js',import.meta.url),'utf8');
 assert.match(index,/client\.sendMessage\(msg\.from,\{image:fs\.readFileSync\(qrPath\),caption\}\)/);
 assert.match(index,/PAYMENT_QR_PATH/);
 assert.match(index,/Jangan transfer dulu/);
 assert.match(index,/pending_review/);
 assert.match(index,/awaiting_proof/);
});

test('customers may reply with just digits and bot gives number-only instruction',()=>{
 assert.equal(parseDuration('7'),7);
 assert.equal(parseDuration('14'),14);
 assert.equal(parseDuration('30'),30);
 assert.equal(parseDuration('DURASI 7'),7); // old conversations still work
 const source=readFileSync(new URL('../whatsapp-bot/index.js',import.meta.url),'utf8');
 assert.match(source,/Cukup balas dengan \*angka saja\*/);
 assert.match(source,/Cukup ketik \*angka jumlah hari\*/);
 assert.match(source,/mengirim QRIS pembayaran/);
});

test('admin can place orders normally, while only validated admin commands are privileged',()=>{
 const admin='6281383919823@c.us';
 const buyer='6288812345678@c.us';
 const sent='Halo BLACKMAMERSTUDIO, saya mau pesan Tripo3D Studio. Kode Produk: tripo. Harga: Rp 20.000 / day. Nama: Pelanggan. Mohon konfirmasi pilihan durasi lisensi.';
 assert.equal(matchProductFromWebsite(sent,catalog)?.product.slug,'tripo');
 assert.equal(shouldHandleAdmin(admin,sent,admin),false);
 assert.equal(shouldHandleAdmin(admin,'!menu',admin),false);
 assert.equal(shouldHandleAdmin(admin,'7',admin),false);
 assert.equal(shouldHandleAdmin(admin,'!orders',admin),true);
 assert.equal(shouldHandleAdmin(admin,'!help',admin),true);
 assert.equal(shouldHandleAdmin(admin,'!reject A1B2C3D4',admin),true);
 assert.equal(shouldHandleAdmin(buyer,'!reject A1B2C3D4',admin),false);
 assert.equal(shouldHandleAdmin(buyer,'!approve A1B2C3D4 '+site+'/install#token='+'a'.repeat(64),admin),false);
 assert.equal(shouldHandleAdmin(admin,'!approve BAD LINK',admin),false);
 const source=readFileSync(new URL('../whatsapp-bot/index.js',import.meta.url),'utf8');
 assert.match(source,/shouldHandleAdmin\(msg\.from,msg\.body,adminJid\)/);
 assert.match(source,/adminMode\?handleAdmin\(msg\):handleCustomer\(msg\)/);
});
test('Baileys logs inbound message-upsert event counts for connection diagnosis',()=>{
 const source=readFileSync(new URL('../whatsapp-bot/baileys-client.js',import.meta.url),'utf8');
 assert.match(source,/\[BAILEYS INCOMING\]/);
});
