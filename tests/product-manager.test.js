import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('Store Settings supports adding and editing named products, images, descriptions',()=>{
  const admin=readFileSync('public/admin.html','utf8');
  const js=readFileSync('public/admin.js','utf8');
  const api=readFileSync('lib/routes/admin-delivery.js','utf8');
  const store=readFileSync('lib/routes/admin-store.js','utf8');
  const delivery=readFileSync('public/admin-delivery.js','utf8');
  for(const id of ['product-create-open','product-create-form','new-product-name','new-product-slug',
    'new-product-description','new-product-image','product-edit-form','edit-product-name',
    'edit-product-description','edit-product-image','edit-product-slug','store-product-preview']){
    assert.ok(admin.includes('id="'+id+'"'),id);
  }
  assert.match(js,/action:'create-product'/);
  assert.match(js,/action:'update-product'/);
  assert.match(js,/data-edit-product/);
  assert.match(js,/function freshProductSlug/);
  assert.match(js,/replace\(\/\\s\+\/g,'-'\)/);
  assert.match(api,/b\.action==='update-product'/);
  assert.match(api,/UPDATE bm_products SET name=\$2,description=\$3,image=\$4/);
  assert.match(store,/slug,name,description,image/);
  assert.match(delivery,/p\.slug/);
});
