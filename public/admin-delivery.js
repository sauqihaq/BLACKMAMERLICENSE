(() => {
 'use strict';
 const $=s=>document.querySelector(s),el=(tag,text='',cls='')=>{const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;};
 const nav=el('button','↗ Produk & Akses','nav-item');nav.dataset.tab='delivery';$('.nav-item[data-tab="store"]').after(nav);
 const section=el('section','','tab hidden');section.id='tab-delivery';$('#tab-store').after(section);
 section.innerHTML="\n<div class=\"section-heading\"><div class=\"eyebrow\">BLACKMAMER / SINGLE ACCESS FLOW</div><h1>Produk & Akses<span class=\"dot\">.</span></h1><p>Satu produk untuk upload script dan penerbitan akses. Pelanggan tidak perlu mengetik license key.</p></div>\n<section class=\"panel product-choice\"><h2>1 · Pilih produk</h2><p>Pilih dari produk yang ada di website atau buat produk baru milikmu.</p>\n<label>PRODUK<select id=\"delivery-tool\"></select></label><p id=\"delivery-product-info\"></p>\n<details><summary>+ Tambah produk baru</summary><form id=\"delivery-create\" class=\"form-stack\">\n<label>NAMA PRODUK<input id=\"dp-name\" required maxlength=\"120\" placeholder=\"BlackMamer Blender Tools\"></label>\n<label>SLUG UNIK<input id=\"dp-slug\" required maxlength=\"36\" pattern=\"[a-z][a-z0-9-]{2,35}\" placeholder=\"blackmamer-blender\"></label>\n<label>DESKRIPSI<input id=\"dp-description\" maxlength=\"500\" placeholder=\"Keterangan produk\"></label>\n<label>GAMBAR<select id=\"dp-image\"><option value=\"/assets/tripo.svg\">3D Cube</option><option value=\"/assets/meshy.svg\">3D Mesh</option><option value=\"/assets/textures.svg\">Texture</option><option value=\"/assets/sketchfab.svg\">3D Model</option></select></label>\n<button class=\"btn btn-primary\">Simpan produk</button></form></details></section>\n<div class=\"two-panels delivery-grid\">\n<article class=\"panel\"><h2>2 · Upload script produk</h2><p>Source tersimpan terenkripsi untuk produk yang dipilih. Tidak ada script template yang otomatis dipakai.</p>\n<form id=\"delivery-upload\" class=\"form-stack\"><label>FILE BMscript<input id=\"delivery-file\" type=\"file\" accept=\".js,.user.js\" required></label>\n<p>Harus memiliki @name dan @match. Maksimal 1 MB.</p><button class=\"btn btn-primary\">Upload versi script</button></form>\n<div id=\"delivery-scripts\" class=\"delivery-list\"></div></article>\n<article class=\"panel\"><h2>3 · Akses pelanggan otomatis</h2><p>Sesudah pembayaran dikonfirmasi, server menerbitkan satu license dan satu link untuk produk yang sama.</p>\n<form id=\"delivery-issue\" class=\"form-stack\">\n<label>NAMA / USERNAME<input id=\"delivery-customer\" required maxlength=\"100\" placeholder=\"Nama pelanggan\"></label>\n<label>PAKET<select id=\"delivery-plan\"><option>Personal</option><option>Pro</option><option>Studio</option></select></label>\n<label>MASA AKTIF (HARI)<input id=\"delivery-days\" type=\"number\" min=\"1\" max=\"3650\" step=\"1\" value=\"30\" required placeholder=\"Contoh: 14\"></label>\n<label class=\"delivery-lifetime\"><input id=\"delivery-lifetime\" type=\"checkbox\"> Lifetime (tanpa batas masa aktif)</label>\n<label>LINK BERLAKU SAMPAI<input id=\"delivery-expiry\" type=\"datetime-local\" required></label>\n<button class=\"btn btn-primary\" id=\"delivery-issue-submit\" disabled>Terbitkan akses + link install</button></form>\n<div id=\"delivery-result\" hidden><p>Salin link privat ke pelanggan; akses akan terikat ke browser pertama saat install.</p>\n<input id=\"delivery-url\" readonly aria-label=\"Link install\"><button class=\"btn btn-primary\" id=\"delivery-copy\">Salin link</button></div></article></div>\n<article class=\"panel\" style=\"margin-top:24px\"><h2>Riwayat link install</h2><div id=\"delivery-links\" class=\"delivery-list\"></div></article>\n<p id=\"delivery-status\" role=\"status\" aria-live=\"polite\"></p>";
 const productToggle=el('button','Sembunyikan dari toko','btn btn-ghost');
 productToggle.type='button';productToggle.hidden=true;
 $('#delivery-product-info').after(productToggle);
 productToggle.onclick=async()=>{
  const p=chosen();if(!p)return;productToggle.disabled=true;
  try{await api('/api/admin/delivery',{action:'set-product',tool:p.slug,active:!p.active});await load(p.slug);status('Status produk diperbarui.');}
  catch(e){status(e.message);}finally{productToggle.disabled=false;}
 };
 const status=s=>$('#delivery-status').textContent=s;
 let products=[],scripts=[];
 async function api(path,data){
  const r=await fetch(path,{method:data?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:{'X-BM-Admin':'1',...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});
  const v=await r.json();if(!r.ok||!v.ok)throw Error(v.message||'Permintaan gagal');return v;
 }
 function chosen(){return products.find(p=>p.slug===$('#delivery-tool').value);}
 function refreshProduct(){
  const p=chosen(),script=p&&scripts.find(s=>s.tool_slug===p.slug);
  $('#delivery-product-info').textContent=p?p.name+' · '+(p.active?'Published':'Hidden'):'Pilih produk terlebih dahulu, agar tidak salah mengambil script Tripo atau produk lain.';
  productToggle.hidden=!p;if(p)productToggle.textContent=p.active?'Sembunyikan dari toko':'Tampilkan di toko';
  $('#delivery-scripts').textContent=script?'Script terpasang: '+script.name+' (v'+script.version+')':'Script belum di-upload untuk produk ini.';
  $('#delivery-issue-submit').disabled=!(p&&p.active&&script);
 }
 async function load(preferred=''){
  const r=await api('/api/admin/delivery');products=r.products;scripts=r.scripts;
  const selector=$('#delivery-tool'),previous=preferred||selector.value;selector.replaceChildren(el('option','— Pilih produk yang benar —'));selector.firstChild.value='';
  for(const p of products){const o=el('option',p.name+' ('+p.slug+')'+(p.active?'':' · hidden'));o.value=p.slug;selector.append(o);}
  if(products.some(p=>p.slug===previous))selector.value=previous;
  refreshProduct();
  $('#delivery-links').replaceChildren(...r.links.map(l=>{
   const row=el('div','','delivery-row'),state=l.revoked?'Dicabut':l.claimed_at?'Diklaim':Date.parse(l.expires_at)<=Date.now()?'Kedaluwarsa':'Siap';
   row.append(el('strong',l.customer+' · '+l.tool_slug),el('span',l.name+' · '+state+' · '+new Date(l.expires_at).toLocaleString('id-ID')));
   if(!l.revoked){const b=el('button','Cabut link','btn btn-ghost');b.onclick=async()=>{if(!confirm('Cabut link instalasi ini?'))return;try{await api('/api/admin/delivery',{action:'revoke-link',id:l.id});await load();}catch(e){status(e.message);}};row.append(b);}
   return row;
  }));
 }
 nav.addEventListener('click',()=>load().catch(e=>status(e.message)));
 $('#delivery-tool').onchange=()=>{refreshProduct();$('#delivery-result').hidden=true;};
 $('#delivery-lifetime').onchange=()=>{
  const days=$('#delivery-days'),lifetime=$('#delivery-lifetime').checked;
  days.disabled=lifetime;
  days.required=!lifetime;
 };
 $('#dp-name').oninput=()=>{if($('#dp-slug').dataset.edited)return;$('#dp-slug').value=$('#dp-name').value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s-]/g,'').trim().replace(/\s+/g,'-').slice(0,36);};
 $('#dp-slug').oninput=()=>{$('#dp-slug').dataset.edited='1';};
 $('#delivery-create').onsubmit=async e=>{
  e.preventDefault();const btn=e.submitter;btn.disabled=true;
  try{const r=await api('/api/admin/delivery',{action:'create-product',name:$('#dp-name').value.trim(),slug:$('#dp-slug').value.trim(),description:$('#dp-description').value.trim(),image:$('#dp-image').value});
   await load(r.product.slug);$('#delivery-create').reset();$('#dp-slug').dataset.edited='';status('Produk berhasil ditambahkan. Upload script-nya kemudian atur harga /day di Store Settings.');
  }catch(err){status(err.message);}finally{btn.disabled=false;}
 };
 $('#delivery-upload').onsubmit=async e=>{
  e.preventDefault();const btn=e.submitter;btn.disabled=true;const product=chosen();
  try{const f=$('#delivery-file').files[0];if(!product||!f||f.size>1048576)throw Error('Pilih produk dan file maksimal 1 MB.');
   await api('/api/admin/delivery',{action:'upload',tool:product.slug,source:await f.text()});
   await load(product.slug);status('Script baru berhasil di-upload ke '+product.name+'.');
  }catch(err){status(err.message);}finally{btn.disabled=false;}
 };
 $('#delivery-issue').onsubmit=async e=>{
  e.preventDefault();const btn=e.submitter;btn.disabled=true;const product=chosen();
  try{if(!product)throw Error('Pilih produk dahulu.');
   const expiry=new Date($('#delivery-expiry').value);if(!Number.isFinite(expiry.getTime()))throw Error('Tanggal salah.');
   const r=await api('/api/admin/delivery',{action:'issue-access',tool:product.slug,customer:$('#delivery-customer').value.trim(),plan:$('#delivery-plan').value,days:$('#delivery-lifetime').checked?'lifetime':Number($('#delivery-days').value),expiresAt:expiry.toISOString()});
   $('#delivery-url').value=new URL(r.access.link.path,location.origin).href;$('#delivery-result').hidden=false;
   status('Akses '+product.name+' untuk '+r.access.customer+' dibuat. Kirim link privat ke pelanggan.');
   await load(product.slug);
  }catch(err){status(err.message);}finally{btn.disabled=false;refreshProduct();}
 };
 $('#delivery-copy').onclick=async()=>{try{await navigator.clipboard.writeText($('#delivery-url').value);status('Link tersalin.');}catch{$('#delivery-url').focus();$('#delivery-url').select();status('Salin link yang terpilih.');}};
 const date=new Date(Date.now()+86400000);
 $('#delivery-expiry').value=new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
 const css=el('style');css.textContent='.delivery-grid{margin-top:22px}.product-choice{margin:20px 0}.product-choice details{padding-top:15px;border-top:1px solid #41343c}.product-choice summary{cursor:pointer;color:#e3adbc;font-weight:700}.product-choice details form{margin-top:18px}.delivery-list{margin-top:18px;color:#c5adbb}.delivery-row{display:flex;align-items:center;gap:16px;padding:16px 0;border-bottom:1px solid #444}.delivery-row span{color:#aaa;flex:1}#delivery-url{width:100%;padding:14px;background:#151515;color:#eee;border:1px solid #444;border-radius:9px;margin-bottom:12px}#delivery-result{margin-top:20px}#delivery-status{padding:18px 0;color:#ddd}';css.textContent+=' .delivery-lifetime{display:flex!important;align-items:center;gap:10px;color:#cbbbc7;font-size:12px;font-weight:600;cursor:pointer}.delivery-lifetime input[type=checkbox]{width:17px;height:17px;accent-color:#bf6a78;margin:0;flex:none}#delivery-days:disabled{opacity:.45;cursor:not-allowed}';document.head.append(css);

})();