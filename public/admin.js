(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const viewNames = {overview:'Overview',licenses:'License Manager',activity:'Activity Logs',store:'Store Settings',security:'Security & Info',delivery:'Produk & Akses'};
  const state = {licenses:[],events:[],summary:null,total:0,loading:false,chosen:null,issuedKey:'',tab:'overview',offset:0,limit:250};
  const html = value => String(value??'').replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const date = value => value ? new Date(value).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'}) : '—';
  const day = value => value ? new Date(value).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}) : 'Lifetime';
  const shortTime = value => value ? new Date(value).toLocaleString('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : '—';
  const relative = value => { if(!value)return 'Belum aktif';const diff=(Date.now()-new Date(value).getTime())/60000;if(diff<2)return 'Baru saja';if(diff<60)return `${Math.floor(diff)} menit lalu`;if(diff<1440)return `${Math.floor(diff/60)} jam lalu`;return shortTime(value); };
  const statusBadge = status => `<span class="status ${status==='active'?'':html(status)}">${html(status.toUpperCase())}</span>`;
  let toastTimer;
  function notice(message,fail=false){const el=$('toast');el.textContent=message;el.className='toast'+(fail?' fail':'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.add('hidden'),4300);}
  async function api(url,{method='GET',data=null}={}){
    const response=await fetch(url,{method,credentials:'same-origin',cache:'no-store',headers:{'X-BM-Admin':'1',...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});
    const info=await response.json().catch(()=>({message:'Response server bukan JSON.'}));
    if(!response.ok||!info.ok){if(response.status===401 && url!=='/api/admin/login')lock();throw Error(info.message||`HTTP ${response.status}`);}
    return info;
  }
  function lock(){$('auth-screen').classList.remove('hidden');$('shell').classList.add('hidden');}
  function unlock(){$('auth-screen').classList.add('hidden');$('shell').classList.remove('hidden');}
  function tab(name){if(!viewNames[name])return;state.tab=name;for(const key of Object.keys(viewNames))$('tab-'+key).classList.toggle('hidden',key!==name);document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.classList.contains('nav-item')&&b.dataset.tab===name));$('current-section').textContent=viewNames[name];window.scrollTo({top:0,behavior:'instant'});if(name==='store')loadAll();}
  function showModal(name){$(name).classList.remove('hidden');}
  function hideModals(){for(const id of ['manage-modal'])$(id)?.classList.add('hidden');}
  async function loadAll(){
    if(state.loading)return;
    state.loading=true;const btn=$('refresh-btn');btn.disabled=true;
    try{
      const [summary,lic,log,store]=await Promise.all([
        api('/api/admin/summary'),
        api(`/api/admin/licenses?limit=${state.limit}&offset=0`),
        api('/api/admin/events?limit=500'),
        api('/api/admin/store')
      ]);
      state.summary=summary.summary;state.licenses=lic.licenses;state.total=lic.total;state.offset=state.licenses.length;state.events=log.events;state.store=store.settings;state.products=store.products||[];
      render();renderStore();
    }catch(err){notice(err.message,true);}
    finally{state.loading=false;btn.disabled=false;}
  }
  async function loadMore(){
    try{const r=await api(`/api/admin/licenses?limit=${state.limit}&offset=${state.offset}`);state.licenses.push(...r.licenses);state.offset+=r.licenses.length;state.total=r.total;renderLicenses();}
    catch(err){notice(err.message,true);}
  }
  function render(){renderStats();renderOverview();renderLicenses();renderEvents();}
  const rupiah = value => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(value);
  function previewDiscount(row){
    const base=Number(row.querySelector('[data-price-tool]').value);
    const percent=Number(row.querySelector('[data-discount-tool]').value)||0;
    const end=row.querySelector('[data-discount-end]').value;
    const box=row.querySelector('.discount-preview');
    if(!Number.isSafeInteger(base)||base<1000){box.textContent='Isi harga normal dulu untuk melihat promo.';return;}
    if(!Number.isInteger(percent)||percent<0||percent>90){box.textContent='Diskon harus 0–90%.';return;}
    if(!percent){box.textContent='Harga normal: '+rupiah(base)+' / day · Diskon tidak aktif';return;}
    if(end && new Date(end).getTime()<=Date.now()){box.textContent='Tanggal promo sudah lewat. Pilih tanggal baru.';return;}
    const discounted=Math.round(base*(100-percent)/100);
    box.textContent=rupiah(base)+' → '+rupiah(discounted)+' / day · Hemat '+percent+'%'+(end?' · Hingga '+new Date(end).toLocaleString('id-ID'):' · Tanpa tanggal akhir');
  }
  function renderStore(){
    const s=state.store;if(!s)return;
    $('store-discord').value=s.discord_url||'';
    $('store-whatsapp').value=s.whatsapp_number?'https://wa.me/'+s.whatsapp_number:'';
    $('store-note').value=s.contact_note||'';
    const fields=$('store-price-fields'),preview=$('store-product-preview');
    fields.replaceChildren();preview.replaceChildren();
    for(const p of state.products||[]){
      const row=document.createElement('div');row.className='discount-editor';
      const heading=document.createElement('div');heading.className='discount-editor-title';
      const title=document.createElement('strong');title.textContent=p.name;
      const status=document.createElement('small');status.textContent=p.active?'PUBLISHED':'HIDDEN';
      heading.append(title,status);row.append(heading);
      const controls=document.createElement('div');controls.className='discount-editor-grid';
      const addField=(labelText,kind,attrs)=>{
        const label=document.createElement('label');label.textContent=labelText;
        const input=document.createElement('input');input.type=kind;
        for(const [key,value] of Object.entries(attrs))input.setAttribute(key,String(value));
        label.append(input);controls.append(label);return input;
      };
      const regular=addField('HARGA NORMAL · RP / DAY','number',{min:1000,max:100000000,step:1000,placeholder:'Contoh: 50000','data-price-tool':p.slug});
      regular.value=p.price_daily??s.prices?.[p.slug]??'';
      const rate=addField('DISKON · %','number',{min:0,max:90,step:1,placeholder:'0 = tanpa diskon','data-discount-tool':p.slug});
      rate.value=p.discount_percent??0;
      const expires=addField('BERAKHIR PADA · OPSIONAL','datetime-local',{'data-discount-end':p.slug});
      if(p.discount_until){
        const end=new Date(p.discount_until);
        if(Number.isFinite(end.getTime()))expires.value=new Date(end.getTime()-end.getTimezoneOffset()*60000).toISOString().slice(0,16);
      }
      row.append(controls);
      const previewText=document.createElement('div');previewText.className='discount-preview';previewText.setAttribute('aria-live','polite');
      row.append(previewText);
      for(const input of [regular,rate,expires])input.addEventListener('input',()=>previewDiscount(row));
      previewDiscount(row);fields.append(row);
      const card=document.createElement('article'),img=document.createElement('img'),name=document.createElement('b'),tag=document.createElement('small');
      img.src=p.image;img.alt=p.name;name.textContent=p.name;
      tag.textContent=(p.discount_percent>0?'DISKON -'+p.discount_percent+'% · ':'')+(p.active?'PUBLISHED':'HIDDEN');
      card.append(img,name,tag);preview.append(card);
    }
  }
  function renderStats(){const s=state.summary||{};$('stat-total').textContent=s.total??'—';$('stat-active').textContent=s.active??'—';$('stat-online').textContent=s.online24h??'—';$('stat-blocked').textContent=s.blocked24h??'—';}
  function person(label,subtitle){const name=String(label||'Unknown');const initial=html(name.slice(0,1).toUpperCase());return `<div class="person"><div class="person-icon">${initial}</div><div><strong>${html(name)}</strong><small>${html(subtitle||'')}</small></div></div>`;}
  function renderOverview(){
    const recent=state.licenses.filter(v=>v.lastSeenAt).sort((a,b)=>new Date(b.lastSeenAt)-new Date(a.lastSeenAt)).slice(0,7);
    $('recent-users').innerHTML=recent.length?recent.map(r=>`<tr><td>${person(r.lastName,r.customer)}</td><td><span class="mono">${html(r.keyMasked)}</span></td><td>${html(relative(r.lastSeenAt))}</td><td>${statusBadge(r.status)}</td></tr>`).join(''):`<tr><td colspan="4" class="empty">Belum ada pengguna yang melakukan aktivasi.</td></tr>`;
    const typeName={activated:'License activated',download:'Model download',convert:'Model conversion',checked:'License verified',rejected:'Access denied',issued:'License issued',admin_update:'Admin updated'};
    $('recent-activity').innerHTML=state.events.length?state.events.slice(0,7).map(e=>`<div class="activity-line"><div class="activity-icon ${html(e.type)}">${e.type==='rejected'?'×':e.type==='activated'?'✓':e.type==='checked'?'↻':'+'}</div><div class="activity-text"><strong>${html(typeName[e.type]||e.type)}</strong><span>${html(e.display_name||e.customer||'Admin')} · ${html(e.description||e.device_id||'License system')}</span></div><span class="activity-time">${html(relative(e.created_at))}</span></div>`).join(''):'<div class="empty">Belum ada aktivitas.</div>';
  }
  function filteredLicenses(){const term=$('license-search').value.trim().toLowerCase();const filter=$('license-filter').value;return state.licenses.filter(r=>(filter==='all'||filter===r.status)&&[r.customer,r.lastName,r.deviceId,r.keyMasked,r.plan].some(v=>String(v||'').toLowerCase().includes(term)));}
  function renderLicenses(){
    $('license-total').textContent=state.total;
    const found=filteredLicenses();
    $('license-rows').innerHTML=found.length?found.map(r=>`<tr><td>${person(r.customer,r.keyMasked)}<span class="mono">${html(r.tool||'tripo').toUpperCase()} · ${html(r.plan)}</span></td><td>${html(r.lastName||'Belum aktivasi')}</td><td><span class="mono">${html(r.deviceId||'Not bound')}</span></td><td>${statusBadge(r.status)}</td><td>${html(relative(r.lastSeenAt))}</td><td>${html(day(r.expiresAt))}</td><td><button class="row-link" data-manage="${html(r.id)}">Manage →</button></td></tr>`).join(''):'<tr><td class="empty" colspan="7">Tidak ada lisensi yang cocok.</td></tr>';
    $('license-range').textContent=`Menampilkan ${found.length} dari ${state.total} license${state.offset<state.total?' (sebagian data belum dimuat)':''}`;
    $('more-btn').classList.toggle('hidden',state.offset>=state.total);
  }
  function filteredEvents(){const term=$('event-search').value.trim().toLowerCase(), filter=$('event-filter').value;return state.events.filter(e=>(filter==='all'||e.type===filter)&&[e.display_name,e.device_id,e.customer,e.key_tail,e.description].some(v=>String(v||'').toLowerCase().includes(term)));}
  function renderEvents(){
    $('event-total').textContent=state.events.length;
    const events=filteredEvents();
    const names={activated:'ACTIVATED',download:'DOWNLOAD',convert:'CONVERT',checked:'VERIFIED',rejected:'REJECTED',issued:'ISSUED',admin_update:'ADMIN UPDATE'};
    $('event-rows').innerHTML=events.length?events.map(e=>`<tr><td><span class="status ${e.type==='rejected'?'revoked':e.type==='activated'?'':'expired'}">${html(names[e.type]||e.type)}</span><small class="mono"> ${html(e.tool_slug||'tripo')}</small></td><td>${html(e.display_name||'—')}</td><td>${html(e.customer||'Tidak ditemukan')}<small class="mono"> ··· ${html(e.license_key_tail||e.key_tail||'')}</small></td><td><span class="mono">${html(e.device_id||'—')}</span></td><td>${html(date(e.created_at))}</td><td>${html(e.description||'—')}</td></tr>`).join(''):'<tr><td colspan="6" class="empty">Belum ada aktivitas yang cocok.</td></tr>';
  }
  function showManage(id){state.chosen=state.licenses.find(x=>x.id===id);if(!state.chosen)return;renderManage();showModal('manage-modal');}
  function renderManage(){const r=state.chosen;if(!r)return;$('manage-title').textContent=r.customer;
    const details=[['License Key',r.keyMasked],['Status',r.status.toUpperCase()],['Last Username',r.lastName||'Belum aktivasi'],['Device ID',r.deviceId||'Belum di-bind'],['First Activated',date(r.activatedAt)],['Last Seen',date(r.lastSeenAt)],['Expiration',day(r.expiresAt)],['Total Checks',r.checkCount],['Tool',(r.tool||'tripo').toUpperCase()],['Plan',r.plan],['Created',date(r.createdAt)]];
    $('manage-details').innerHTML=details.map(([name,value])=>`<div class="detail"><div class="detail-label">${html(name.toUpperCase())}</div><div class="detail-value">${html(value)}</div></div>`).join('');
    $('action-revoke').textContent=r.status==='revoked'?'Restore License':'Revoke License';$('action-revoke').className='btn '+(r.status==='revoked'?'btn-ghost':'btn-danger');
  }
  async function action(name,options={},confirmation=''){
    const r=state.chosen;if(!r)return;
    if(confirmation&&!confirm(confirmation))return;
    try{
      const data=await api('/api/admin/license-action',{method:'POST',data:{id:r.id,action:name,...options}});
      state.chosen=data.license;renderManage();await loadAll();notice('License berhasil diperbarui.');
    }catch(err){notice(err.message,true);}
  }
  function wire(){
    $('login-form').addEventListener('submit',async e=>{e.preventDefault();const b=$('login-submit');b.disabled=true;$('login-error').classList.add('hidden');
      try {const result=await api('/api/admin/login',{method:'POST',data:{username:$('login-user').value,password:$('login-pass').value}});$('admin-display').textContent=result.username;$('login-pass').value='';unlock();await loadAll();notice('Login berhasil.');}
      catch(err){$('login-error').textContent=err.message;$('login-error').classList.remove('hidden');}
      finally{b.disabled=false;}
    });
    $('logout-btn').addEventListener('click',async()=>{try{await api('/api/admin/logout',{method:'POST'});}catch{}lock();state.licenses=[];state.events=[];});
    $('refresh-btn').onclick=()=>{loadAll().then(()=>notice('Data diperbarui.'));};$('refresh-log').onclick=()=>loadAll();
    $('more-btn').onclick=loadMore;
    for(const id of ['license-search','license-filter'])$(id).addEventListener('input',renderLicenses);
    for(const id of ['event-search','event-filter'])$(id).addEventListener('input',renderEvents);
    document.addEventListener('click',e=>{
      const t=e.target.closest('[data-tab],[data-open-delivery],[data-close-modal],[data-manage]');
      if(!t)return;
      if(t.dataset.tab)tab(t.dataset.tab);
      if(t.hasAttribute('data-open-delivery'))document.querySelector('.nav-item[data-tab="delivery"]')?.click();
      if(t.hasAttribute('data-close-modal'))hideModals();
      if(t.dataset.manage)showManage(t.dataset.manage);
    });
    document.querySelectorAll('.modal-cover').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)hideModals();}));
    document.addEventListener('keydown',e=>{if(e.key==='Escape')hideModals();});
    $('export-btn').onclick=()=>{location.href='/api/admin/export';};
    $('store-form').addEventListener('submit',async e=>{
      e.preventDefault();const button=$('save-store');button.disabled=true;
      try {
        const prices={};
        const discounts={};
        document.querySelectorAll('#store-price-fields .discount-editor').forEach(row=>{
          const priceInput=row.querySelector('[data-price-tool]'),rateInput=row.querySelector('[data-discount-tool]'),endInput=row.querySelector('[data-discount-end]');
          const slug=priceInput.dataset.priceTool;
          prices[slug]=priceInput.value.trim()?Number(priceInput.value):null;
          const percent=Number(rateInput.value||0);
          const endsAt=endInput.value?new Date(endInput.value).toISOString():null;
          discounts[slug]={percent,endsAt};
        });
        const result=await api('/api/admin/store',{method:'POST',data:{discordUrl:$('store-discord').value.trim(),whatsappNumber:$('store-whatsapp').value.trim(),note:$('store-note').value.trim(),prices,discounts}});
        state.store=result.settings;
        for(const p of state.products||[]){
          p.price_daily=prices[p.slug];
          p.discount_percent=discounts[p.slug].percent;
          p.discount_until=discounts[p.slug].endsAt;
        }
        renderStore();notice('Harga dan diskon produk berhasil diperbarui.');
      }catch(err){notice(err.message,true);}finally{button.disabled=false;}
    });
    $('action-bind').onclick=()=>{const id=prompt('Tempel Device ID (bmdev_...):',state.chosen?.deviceId||'bmdev_');if(id!==null)action('bind-device',{deviceId:id.trim()});};
    $('action-reset').onclick=()=>action('reset-device',{},'Reset binding perangkat? Perangkat lama harus validasi ulang dan key bisa diaktivasi pada perangkat baru.');
    $('action-expiry').onclick=()=>{const days=prompt('Durasi mulai sekarang dalam hari (1–3650), atau ketik lifetime:', '30');if(days===null)return;const n=days.trim().toLowerCase()==='lifetime'?null:Number(days);if(n!==null&&(!Number.isSafeInteger(n)||n<1||n>3650))return notice('Isi 1–3650 atau lifetime.',true);action('set-expiry',{days:n});};
    $('action-rename').onclick=()=>{const name=prompt('Nama pelanggan baru:',state.chosen?.customer||'');if(name!==null)action('rename',{customer:name});};
    $('action-revoke').onclick=()=>{const restore=state.chosen?.status==='revoked';action(restore?'restore':'revoke',{},restore?'Aktifkan kembali license?':'Revoke license ini? Pengguna tidak bisa validasi lagi.');};
  }
  async function boot(){wire();try{const me=await api('/api/admin/me');$('admin-display').textContent=me.username;unlock();await loadAll();}catch{lock();}
    setInterval(()=>{if(!$('shell').classList.contains('hidden')&&document.visibilityState==='visible'&&!state.loading&&state.tab!=='store')loadAll();},45000);
  }
  boot();
})();
