import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeWhatsAppNumber} from '../lib/whatsapp.js';
test('normalize WhatsApp admin input',()=>{
 assert.equal(normalizeWhatsAppNumber('https://wa.me/6281234567890'),'6281234567890');
 assert.equal(normalizeWhatsAppNumber('6281234567890'),'6281234567890');
 assert.equal(normalizeWhatsAppNumber('+6281234567890'),'6281234567890');
 assert.equal(normalizeWhatsAppNumber('081234567890'),'6281234567890');
 assert.equal(normalizeWhatsAppNumber(''),'');
 for(const v of ['https://evil.com/6281234567890','https://wa.me/','abc','1','https://wa.me/6281234567890?text=bad'])
 assert.equal(normalizeWhatsAppNumber(v),null,v);
});
test('checkout is a native wa.me link with day price',()=>{
 const h=readFileSync('public/index.html','utf8'),js=readFileSync('public/store.js','utf8'),admin=readFileSync('public/admin.html','utf8');
 assert.match(h,/<a id="buy-wa"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
 assert.match(js,/https:\/\/wa\.me\//);
 assert.match(js,/encodeURIComponent\(getMessage\(\)\)/);
 assert.match(js,/\+\s*' \/ day'/);
 assert.match(admin,/HARGA HARIAN & DISKON PRODUK/);
 assert.match(admin,/WHATSAPP LINK/);
});
