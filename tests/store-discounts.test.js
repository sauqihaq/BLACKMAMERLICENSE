import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculatePrice,effectiveDiscount} from '../lib/pricing.js';

test('valid discount is based on the real daily list price',()=>{
 const p=calculatePrice(50000,20,null);
 assert.deepEqual(p,{price:40000,originalPrice:50000,discountPercent:20,discountUntil:null});
 assert.equal(calculatePrice(99999,25).price,74999);
 assert.equal(calculatePrice(50000,0).price,50000);
 assert.equal(calculatePrice(null,25).price,null);
});
test('ending the promotion returns to normal price automatically',()=>{
 const now=Date.parse('2026-11-19T00:00:00Z');
 const end='2026-11-20T00:00:00Z';
 assert.equal(calculatePrice(50000,20,end,now).price,40000);
 assert.equal(calculatePrice(50000,20,end,now+86400000).price,50000);
 assert.equal(effectiveDiscount(20,end,now+86400000),0);
 assert.equal(effectiveDiscount(20,null,now),20);
 assert.equal(effectiveDiscount(101,null,now),0);
 assert.equal(effectiveDiscount(-3,null,now),0);
});
test('catalog and checkout show the discount and old price',()=>{
 const client=readFileSync('public/store.js','utf8');
 const page=readFileSync('public/index.html','utf8');
 const admin=readFileSync('public/admin.js','utf8');
 const service=readFileSync('lib/routes/public-store.js','utf8');
 assert.match(client,/discount-badge/);
 assert.match(client,/pricesFor\(t\)/);
 assert.match(client,/class="old-price"/);
 assert.match(client,/buy-original-price/);
 assert.match(client,/activePromo\(selected\)/);
 assert.match(client,/Harga promo:/);
 assert.match(page,/id="buy-sale-badge"/);
 assert.match(admin,/data-discount-tool/);
 assert.match(admin,/data-discount-end/);
 assert.match(admin,/discounts\}\}/);
 assert.match(service,/calculatePrice\(/);
});
