(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const toggle=$('bm-ai-toggle'),panel=$('bm-ai-panel'),close=$('bm-ai-close');
 const form=$('bm-ai-form'),input=$('bm-ai-input'),send=$('bm-ai-send'),messages=$('bm-ai-messages');
 const status=$('bm-ai-status'),quick=$('bm-ai-quick'),clear=$('bm-ai-clear'),wa=$('bm-ai-whatsapp');
 if(!toggle||!panel||!form)return;
 const history=[];
 let busy=false;
 let contactPhone='62881080044640';
 const controls=[toggle,close,send,clear];
 function openChat(open){
  panel.hidden=!open;
  toggle.setAttribute('aria-expanded',String(open));
  if(open){input.focus({preventScroll:true});messages.scrollTop=messages.scrollHeight;}
  else toggle.focus({preventScroll:true});
 }
 function append(role,text){
  const el=document.createElement('div');
  el.className='bm-ai-message '+(role==='user'?'bm-ai-user':'bm-ai-bot');
  el.textContent=String(text);
  messages.appendChild(el);
  messages.scrollTop=messages.scrollHeight;
  return el;
 }
 function updateStatus(mode,notice){
  status.textContent=mode==='ai'?'AI Assistant • online':'Asisten panduan • otomatis';
  status.classList.toggle('bm-ai-status-faq',mode!=='ai');
  if(notice)append('assistant',notice);
 }
 async function sendText(text){
  const message=String(text||'').trim();
  if(busy||!message)return;
  if(message.length>900){append('assistant','Pesan maksimal 900 karakter ya.');return;}
  append('user',message);
  input.value='';input.style.height='';
  busy=true;send.disabled=true;input.disabled=true;quick.hidden=true;
  const pending=append('assistant','Sedang menyiapkan jawaban…');
  try{
   const result=await fetch('/api/ai-chat',{
    method:'POST',cache:'no-store',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({message,history:history.slice(-8)}),
    signal:AbortSignal.timeout(20000)
   });
   const data=await result.json();
   if(!result.ok||!data.ok)throw new Error(data.error||'Layanan sedang tidak tersedia.');
   pending.textContent=data.reply||'Maaf, belum ada jawaban.';
   history.push({role:'user',text:message},{role:'assistant',text:pending.textContent});
   while(history.length>8)history.shift();
   status.textContent=data.mode==='ai'?'AI Assistant • aktif':'Asisten panduan • otomatis';
   status.classList.toggle('bm-ai-status-faq',data.mode!=='ai');
   if(data.notice) {
    const n=document.createElement('p');n.className='bm-ai-notice';n.textContent=data.notice;
    messages.appendChild(n);
   }
  }catch(e){
   pending.textContent=e.name==='TimeoutError'?'Balasan terlalu lama. Coba lagi atau hubungi admin WhatsApp.':String(e.message||'Koneksi gagal. Silakan coba lagi.');
  }finally{
   busy=false;send.disabled=false;input.disabled=false;input.focus({preventScroll:true});
   messages.scrollTop=messages.scrollHeight;
  }
 }
 toggle.addEventListener('click',()=>openChat(panel.hidden));
 close.addEventListener('click',()=>openChat(false));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)openChat(false);});
 form.addEventListener('submit',e=>{e.preventDefault();sendText(input.value);});
 input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();form.requestSubmit();}});
 quick.addEventListener('click',e=>{
  const button=e.target.closest('button[data-question]');if(button)sendText(button.dataset.question);
 });
 clear.addEventListener('click',()=>{
  history.length=0;messages.replaceChildren();
  append('assistant','Halo! 👋 Ada yang bisa kubantu tentang lisensi, pembayaran, atau instalasi BMscript?');
  quick.hidden=false;status.textContent='Asisten BLACKMAMERSTUDIO';
 });
 function updateWa(){
  wa.href='https://wa.me/'+contactPhone+'?text='+encodeURIComponent('Halo admin BLACKMAMERSTUDIO, saya ingin bertanya tentang lisensi atau instalasi BMscript.');
 }
 updateWa();
 fetch('/api/store',{cache:'no-store'}).then(r=>r.json()).then(d=>{
  const phone=String(d?.contacts?.botWhatsappNumber||d?.contacts?.whatsappNumber||'').replace(/\D/g,'');
  if(/^[1-9]\d{7,14}$/.test(phone)){contactPhone=phone;updateWa();}
 }).catch(()=>{});
})();
