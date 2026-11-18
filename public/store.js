(function(){
'use strict';
const defaultCatalog=[
{slug:'tripo',name:'Tripo3D Studio',eyebrow:'MODEL · CONVERTER',description:'Manajemen file 3D dan konversi lokal untuk aset yang dimiliki atau diizinkan.',features:['GLB / GLTF','Konversi lokal','Browser extension'],image:'/assets/tripo.svg'},
{slug:'meshy',name:'Meshy 3D Tools',eyebrow:'WORKFLOW · 3D',description:'Workflow file dan model yang kamu miliki; tidak membuka paywall.',features:['Model milik sendiri','GLB tools','Device ID'],image:'/assets/meshy.svg'},
{slug:'sketchfab-textures',name:'Sketchfab Texture Kit',eyebrow:'TEXTURE · MATERIALS',description:'Ekstrak tekstur dari GLB milikmu atau aset yang boleh diunduh.',features:['Texture PNG','GLB lokal','Material workflow'],image:'/assets/textures.svg'},
{slug:'sketchfab-model',name:'BLACKMAMERSTUDIO | Model Tools SILVER',eyebrow:'SKETCHFAB · MODEL TOOLS',description:'Pilih file GLB dari perangkatmu di panel SILVER, lalu konversi dan unduh hasilnya sebagai FBX.',features:['File GLB lokal','Ekspor FBX','Panel SILVER'],image:'/assets/sketchfab.svg'}];
const $=id=>document.getElementById(id);
let catalog=[],contacts={discordUrl:'',whatsappNumber:'',note:''},selected=null;
const money=n=>n==null?'Tanya Admin':new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n)+' / day';
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function render(){
$('cards').innerHTML=catalog.map((t,i)=>'<article class="card"><div class="card-visual"><span class="card-index">0'+(i+1)+' / ACCESS</span><img src="'+escapeHTML(t.image)+'" alt="Ilustrasi '+escapeHTML(t.name)+'" loading="lazy"></div><div class="card-body"><div class="card-eyebrow">'+escapeHTML(t.eyebrow)+'</div><h3>'+escapeHTML(t.name)+'</h3><p>'+escapeHTML(t.description)+'</p><div class="features">'+t.features.map(f=>'<span>'+escapeHTML(f)+'</span>').join('')+'</div><div class="price-row"><div><small>STARTING FROM</small><b>'+money(t.price)+'</b></div><button type="button" data-buy="'+escapeHTML(t.slug)+'">PILIH TOOL ↗</button></div></div></article>').join('');
document.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>openBuy(b.dataset.buy));
}
function whatsappPhone(){
 const phone=String(contacts.whatsappNumber||'').replace(/[^0-9]/g,'');
 return /^[1-9][0-9]{7,14}$/.test(phone)?phone:'';
}
function updateWhatsAppLink(){
 const link=$('buy-wa');
 const phone=whatsappPhone();
 const ready=!!(selected&&phone);
 link.setAttribute('aria-disabled',String(!ready));
 link.tabIndex=ready?0:-1;
 link.href=ready?'https://wa.me/'+phone+'?text='+encodeURIComponent(getMessage()):'#';
}
function openBuy(slug){selected=catalog.find(t=>t.slug===slug);if(!selected)return;
$('buy-install').href='/extension';
$('buy-image').src=selected.image;$('buy-title').textContent=selected.name;$('buy-desc').textContent=selected.description;$('buy-price').textContent=money(selected.price);
updateWhatsAppLink();$('buy-discord').disabled=!contacts.discordUrl;
$('buy-help').textContent=(!contacts.whatsappNumber&&!contacts.discordUrl)?'Kontak admin belum dikonfigurasi. Silakan hubungi pemilik website.':(contacts.note||'Admin akan memberikan instruksi pembayaran. License dibuat setelah pembayaran diverifikasi.');
$('buy-modal').classList.remove('hidden');$('buyer-name').focus();}
function closeBuy(){$('buy-modal').classList.add('hidden');}
function getMessage(){return 'Halo admin BLACKMAMERSTUDIO, saya mau pesan '+selected.name+'. Harga: '+money(selected.price)+'. Nama: '+($('buyer-name').value.trim()||'(belum diisi)')+'. Mohon info pembayaran dan proses license.';}
$('close-buy').onclick=closeBuy;$('buy-modal').onclick=e=>{if(e.target===$('buy-modal'))closeBuy();};document.addEventListener('keydown',e=>{if(e.key==='Escape')closeBuy();});
$('buyer-name').addEventListener('input',updateWhatsAppLink);
$('buy-wa').addEventListener('click',event=>{
 updateWhatsAppLink();
 if($('buy-wa').getAttribute('aria-disabled')==='true'){
  event.preventDefault();
  $('buy-help').textContent='WhatsApp admin belum diatur. Admin perlu mengisi link wa.me di Store Settings.';
 }
});
$('buy-discord').onclick=()=>{if(!selected||!contacts.discordUrl)return;navigator.clipboard?.writeText(getMessage()).catch(()=>{});window.open(contacts.discordUrl,'_blank','noopener,noreferrer');$('buy-help').textContent='Discord dibuka. Salin pesan pembelian bila diperlukan: '+getMessage();};
fetch('/api/store',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('API belum siap');return r.json();}).then(data=>{if(!data.ok)throw Error('Store tidak tersedia');catalog=data.catalog;contacts=data.contacts;render();if(selected)updateWhatsAppLink();}).catch(()=>{$('cards').textContent='Katalog belum tersedia. Hubungi admin.';$('catalog-note').textContent='Tidak dapat memuat produk dari server.';});
})();
