import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDuration,priceFor,matchProductFromWebsite,productBySlug,validInstallLink,parseAdminCommand} from '../whatsapp-bot/core.js';
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
