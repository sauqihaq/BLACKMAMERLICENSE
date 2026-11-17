(() => {
 const $=id=>document.getElementById(id),id=crypto.randomUUID();let connected=false;
 window.addEventListener('message',e=>{if(e.source!==window||e.origin!==location.origin||e.data?.channel!=='BM_EXTENSION_RESPONSE'||e.data.id!==id||!e.data.result?.connected)return;connected=true;$('extension-title').textContent='BlackMamer sudah terpasang';$('extension-message').textContent='Kembali ke link pembelian untuk menginstal userscript.';});
 window.postMessage({channel:'BM_SITE_REQUEST',id,action:'ping'},location.origin);
 fetch('/api/store',{cache:'no-store'}).then(r=>r.json()).then(data=>{if(data.extension?.storeUrl){const u=new URL(data.extension.storeUrl);if(u.hostname==='chromewebstore.google.com'&&u.protocol==='https:'){$('extension-store').href=u.href;$('extension-store').hidden=false;}}if(data.extension?.downloadAvailable){$('extension-download').hidden=false;$('extension-manual').hidden=false;}}).catch(()=>{});
 setTimeout(()=>{if(!connected){$('extension-title').textContent='Pasang BlackMamer';$('extension-message').textContent=$('extension-store').hidden?'Versi Chrome Web Store belum tersedia. Instalasi satu klik akan aktif setelah ekstensi diterbitkan.':'Buka Chrome Web Store dan pilih Add to Chrome. Setelah selesai, muat ulang link pembelian.';}},2500);
})();
