(() => {
  const requestId = crypto.randomUUID();
  window.addEventListener('message', event => {
    const reply = event.data;
    if (event.origin !== location.origin || event.source !== window ||
        reply?.channel !== 'BM_EXTENSION_RESPONSE' || reply.id !== requestId ||
        reply.result?.connected !== true) return;
    document.getElementById('extension-title').textContent = 'BlackMamer sudah terpasang';
    document.getElementById('extension-message').textContent = 'Buka kembali link pembelian untuk memasang userscript.';
    document.getElementById('extension-manual').hidden = true;
  });
  window.postMessage({ channel: 'BM_SITE_REQUEST', id: requestId, action: 'ping' }, location.origin);
})();
