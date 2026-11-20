import test from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {parseDuration,priceFor,matchProductFromWebsite,productBySlug,validInstallLink,parseAdminCommand,paymentCaption} from '../whatsapp-bot/core.js';
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

import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStore} from '../whatsapp-bot/store.js';
import {installationGuide,approvedMessage,isSupportRequest,isSupportExit,isGuideRequest,parseSupportAdminCommand} from '../whatsapp-bot/support.js';

test('approved message includes real extension and BMscript setup',()=>{
 const link=site+'/install#token='+'a'.repeat(64);
 const value=approvedMessage({orderId:'A1B2C3D4',installUrl:link,site});
 for(const part of ['/extension','chrome://extensions','Developer mode','Load unpacked','manifest.json','Allow user scripts','Install BMscript','ADMIN',link]){
  assert.ok(value.includes(part),part);
 }
 assert.ok(!installationGuide(site).includes('#token'));
 assert.throws(()=>approvedMessage({orderId:'A1B2C3D4',installUrl:'https://evil.example/install#token='+'a'.repeat(64),site}));
});
test('support commands and customer guide are parsed without changing checkout',()=>{
 for(const input of ['ADMIN','BANTUAN','chat admin','hubungi admin'])assert.equal(isSupportRequest(input),true);
 for(const input of ['PANDUAN','TUTORIAL','cara pasang'])assert.equal(isGuideRequest(input),true);
 assert.equal(isSupportExit('SELESAI'),true);
 assert.equal(isSupportRequest('7'),false);
 assert.deepEqual(parseSupportAdminCommand('!tickets'),{op:'tickets'});
 assert.deepEqual(parseSupportAdminCommand('!reply a1b2c3d4 Halo'),{op:'reply',id:'A1B2C3D4',message:'Halo'});
 assert.deepEqual(parseSupportAdminCommand('!close A1B2C3D4'),{op:'close',id:'A1B2C3D4'});
 for(const input of ['!reply A1B2C3D4','!close A1B2C3D4 Halo','!approve A1B2C3D4','!reply invalid Halo'])assert.equal(parseSupportAdminCommand(input),null);
});
test('support tickets persist across restart without changing previous orders',()=>{
 const dir=mkdtempSync(join(tmpdir(),'blackmamer-support-'));
 try{
  const db=createStore(dir),jid='6281256789012@c.us';
  const order=db.create({jid,productName:'Tripo',productSlug:'tripo'});
  const {ticket,created}=db.openSupport(jid,order.id);
  assert.equal(created,true);
  assert.equal(db.openSupport(jid).created,false);
  const restored=createStore(dir);
  assert.equal(restored.get(order.id)?.status,'choose_duration');
  assert.equal(restored.activeSupportFor(jid)?.id,ticket.id);
  assert.equal(restored.listSupport().length,1);
  assert.equal(restored.closeSupport(ticket.id)?.status,'closed');
  assert.equal(createStore(dir).activeSupportFor(jid),null);
 }finally{rmSync(dir,{force:true,recursive:true});}
});
test('support routing does not override approve or QRIS and requires admin JID',()=>{
 const source=readFileSync(new URL('../whatsapp-bot/index.js',import.meta.url),'utf8');
 assert.ok(source.indexOf('if(isSupportRequest(body))')<source.indexOf("if(/^!(menu|produk)$/i.test(body))"));
 assert.match(source,/const admin=msg\.from===adminJid/);
 assert.match(source,/parseSupportAdminCommand\(msg\.body\)/);
 assert.match(source,/client\.sendMessage\(ticket\.jid/);
 assert.match(source,/approvedMessage\(\{orderId:order\.id,installUrl:url,site\}\)/);
 assert.match(source,/store\.closeSupport/);
});
