// ==UserScript==
// @name         BLACKMAMER STUDIO - __TITLE__
// @namespace    https://blackmamerstudio.local/
// @version      13.0.0
// @description  Licensed workflow for assets you own or are authorized to download. No paywall bypass.
// @author       BlackMamerStudio
// @match        __MATCH_A__
// @match        __MATCH_B__
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      __API_HOST__
// ==/UserScript==
(function(){
  'use strict';
  const TOOL='__TOOL__', API='__API_BASE__', TITLE='__TITLE__';
  if(window['__bmInstalled_'+TOOL])return;
  window['__bmInstalled_'+TOOL]=true;
  const KEY='bm_license_'+TOOL, NAME='bm_user_'+TOOL, DEVICE='bm_device_id';
  const deviceId=GM_getValue(DEVICE)||'bmdev_'+crypto.randomUUID();
  GM_setValue(DEVICE,deviceId);
  const css=`
    :host{all:initial;--bg:#07121d;--accent:#55e3d7;color:#edf7ff;font:13px/1.5 system-ui,Segoe UI,sans-serif}
    *,*:before,*:after{box-sizing:border-box}.launch{position:fixed;bottom:24px;right:24px;z-index:2147483644;background:linear-gradient(130deg,#b1fff5,#55e3d7);border:1px solid #b3fff0;border-radius:50px;padding:12px 18px;color:#062c32;font-weight:900;cursor:pointer;box-shadow:0 6px 28px #0008}
    .overlay{position:fixed;inset:0;background:#020d18c9;z-index:2147483645;display:grid;place-items:center;padding:15px;backdrop-filter:blur(5px)}.overlay[hidden]{display:none}
    .panel{width:min(460px,100%);max-height:95vh;overflow:auto;background:linear-gradient(150deg,#153344,#071522);border:1px solid #397c83;border-radius:19px;padding:26px;box-shadow:0 20px 80px #000b}.eyebrow{font-size:10px;letter-spacing:.17em;color:#55e3d7;font-weight:900}.heading{display:flex;justify-content:space-between;align-items:start}.heading button{border:1px solid #467481;background:#1b3342;color:white;border-radius:8px;padding:5px 11px;font-size:20px;cursor:pointer}.panel h2{font-size:25px;color:white;margin:13px 0 5px}.panel p,.help{font-size:12px;color:#a4bbc8;line-height:1.7}.row{display:grid;gap:11px;margin:16px 0}.row label{font-size:10px;letter-spacing:.12em;font-weight:900;color:#98cfcd}.row input{display:block;margin-top:6px;width:100%;padding:12px;background:#061926;border:1px solid #3b6273;border-radius:9px;color:#e3fffa;outline:none}.button{border:1px solid #5cf1de;background:#55e3d7;color:#032b32;padding:11px 15px;border-radius:9px;font-weight:900;cursor:pointer}.button:disabled{opacity:.5;cursor:not-allowed}.button.alt{background:#163b48;color:#b7fff5}.actions{display:flex;gap:8px;flex-wrap:wrap}.actions button{flex:1}.status{margin:14px 0;font-size:12px;padding:11px;background:#112b3a;border:1px solid #2c5364;border-radius:9px;overflow-wrap:anywhere}.tools{padding-top:13px;border-top:1px solid #2f5661}.fileinput{display:block;max-width:100%;font-size:11px;color:#b5eee4}.fileinput::file-selector-button{background:#1a4e55;color:#c4fff7;border:1px solid #438b8b;border-radius:7px;padding:8px;margin-right:9px}
    .foot{border-top:1px solid #2a5462;padding-top:15px;color:#83a5b5;font-size:10px;margin-top:20px}
  `;
  function saveBlob(blob,name){const href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),30000);}
  async function request(endpoint,action){
    const r=await fetch(API+'/api/license/'+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:key.value.trim().toUpperCase(),deviceId,displayName:user.value.trim(),tool:TOOL,action})});
    const data=await r.json();if(!r.ok||!data.ok)throw Error(data.message||'Aktivasi gagal.');return data;
  }
  function parseGlb(buffer){
    const view=new DataView(buffer);if(buffer.byteLength<20||view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==buffer.byteLength)throw Error('File harus GLB 2.0 yang valid.');
    let off=12,json=null,bin=null;while(off+8<=buffer.byteLength){const n=view.getUint32(off,true),kind=view.getUint32(off+4,true);off+=8;if(n>buffer.byteLength-off)throw Error('GLB chunk rusak.');if(kind===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,off,n)).replace(/\0+$/g,''));else if(kind===0x004e4942)bin=new Uint8Array(buffer,off,n);off+=n;}if(!json)throw Error('GLB JSON tidak ada.');return {json,bin};
  }
  function imageData({json,bin},image){
    if(image.bufferView!==undefined){const view=json.bufferViews?.[image.bufferView];if(!view||!bin||view.buffer!==0&&view.buffer!==undefined)throw Error('Gambar memakai buffer eksternal.');const start=view.byteOffset||0,end=start+view.byteLength;if(end>bin.byteLength)throw Error('Rentang gambar tidak valid.');return new Blob([bin.slice(start,end)],{type:image.mimeType||'application/octet-stream'});}
    if(typeof image.uri==='string'&&image.uri.startsWith('data:')){const comma=image.uri.indexOf(','),head=image.uri.slice(5,comma),body=image.uri.slice(comma+1);if(comma<0)throw Error('Data URI tidak valid.');const raw=/;base64/i.test(head)?atob(body):decodeURIComponent(body);return new Blob([Uint8Array.from(raw,c=>c.charCodeAt(0))],{type:head.split(';')[0]||'application/octet-stream'});}
    throw Error('Gambar eksternal: pakai GLB yang menanamkan tekstur.');
  }
  async function textureDownload(file){
    if(file.size>300*1024*1024)throw Error('File maksimal 300 MB.');
    const parsed=parseGlb(await file.arrayBuffer());const images=parsed.json.images||[];if(!images.length)throw Error('GLB tidak berisi image tertanam.');
    let n=0;for(let i=0;i<images.length;i++){
      const blob=imageData(parsed,images[i]);let png;
      try{const bitmap=await createImageBitmap(blob),canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);bitmap.close();png=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Gagal konversi PNG')),'image/png'));}
      catch{throw Error('Format tekstur tidak dapat dibaca browser.');}
      saveBlob(png,file.name.replace(/\.glb$/i,'')+'_texture_'+i+'.png');n++;
    }return n;
  }
  const host=document.createElement('div');host.id='bm-licensed-'+TOOL;
  document.documentElement.appendChild(host);const root=host.attachShadow({mode:'open'});
  root.innerHTML='<style>'+css+'</style><button class="launch">◈ BLACKMAMER ACCESS</button><div class="overlay" hidden><div class="panel"><div class="heading"><div class="eyebrow">BLACKMAMERSTUDIO · LICENSED ACCESS</div><button class="close">×</button></div><h2></h2><p>Aktivasi license untuk satu tool dan satu instalasi browser. Gunakan hanya aset yang kamu miliki atau boleh diunduh.</p><div class="row"><label>NAMA / USERNAME<input class="username" maxlength="80" placeholder="Nama pelanggan" /></label><label>LICENSE KEY<input class="key" placeholder="BM-...-XXXXX" /></label></div><div class="actions"><button class="button activate">Activate License</button><button class="button alt verify">Verify</button></div><div class="status" role="status">Belum teraktivasi.</div><div class="tools"><div class="row"><label>AUTHORIZED DOWNLOAD URL<input class="url" placeholder="https://.../file.glb" /></label></div><div class="actions"><button class="button alt download">Download provided URL</button></div><p class="help">Masukkan link unduhan yang memang kamu punya izin aksesnya. Tidak ada pemindaian cache, viewer ripping, atau bypass fitur berbayar.</p><div class="row"><label>EXTRACT LOCAL GLB TEXTURES<input class="fileinput" type="file" accept=".glb,model/gltf-binary" /></label></div><button class="button alt extract">Export embedded textures as PNG</button></div><div class="foot">DEVICE BINDING · <span class="device"></span></div></div></div>';
  const $=q=>root.querySelector(q), key=$('.key'),user=$('.username'),status=$('.status');
  $('.panel h2').textContent=TITLE;$('.device').textContent=deviceId;
  key.value=GM_getValue(KEY,'');user.value=GM_getValue(NAME,'');
  $('.launch').onclick=()=>{$('.overlay').hidden=false;};$('.close').onclick=()=>{$('.overlay').hidden=true;};$('.overlay').onclick=e=>{if(e.target===$('.overlay'))$('.overlay').hidden=true;};
  async function run(cb){status.textContent='Menghubungi license server...';try{await cb();}catch(e){status.textContent='✕ '+e.message;}}
  $('.activate').onclick=()=>run(async()=>{const r=await request('activate','open');GM_setValue(KEY,key.value.trim().toUpperCase());GM_setValue(NAME,user.value.trim());status.textContent='✓ ACTIVE · '+r.customer;});
  $('.verify').onclick=()=>run(async()=>{const r=await request('validate','check');status.textContent='✓ License valid hingga '+(r.expiresAt||'Lifetime');});
  $('.download').onclick=()=>run(async()=>{
    const url=$('.url').value.trim();let parsed;try{parsed=new URL(url);}catch{throw Error('URL salah.');}
    if(parsed.protocol!=='https:')throw Error('Link wajib HTTPS.');
    await request('validate','download');window.open(parsed.href,'_blank','noopener,noreferrer');status.textContent='✓ Membuka URL unduhan resmi. Jika gagal, periksa izin unduh dan masa berlaku link.';
  });
  $('.extract').onclick=()=>run(async()=>{const file=$('.fileinput').files?.[0];if(!file)throw Error('Pilih file GLB dari komputer dulu.');await request('validate','convert');const n=await textureDownload(file);status.textContent='✓ '+n+' file PNG diproses.';});
})();
