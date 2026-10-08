/* I4-3 opt-in transport diagnostic. Disabled unless URL has cbsI4Probe=1.
 * Never exports POI data or logs response bodies.
 */
;(() => {
  'use strict';
  if (new URL(location.href).searchParams.get('cbsI4Probe') !== '1') return;
  const EVT = 'cbs-i3:evt', CMD = 'cbs-i3:cmd';
  let snapshot = null, sid = null, busy = false;
  const button = document.createElement('button');
  button.textContent = '🔬 I4通信診断';
  button.style.cssText = 'position:fixed;right:12px;top:76px;z-index:2147483646;padding:9px;border-radius:9px;background:#0f172a;color:white;border:1px solid #94a3b8';
  const output = document.createElement('pre');
  output.style.cssText = 'display:none;position:fixed;left:12px;right:12px;top:120px;z-index:2147483646;padding:12px;background:#0f172a;color:#fff;border-radius:10px;white-space:pre-wrap;max-height:30vh;overflow:auto;font:12px/1.5 monospace';
  const show = value => { output.style.display = 'block'; output.textContent = value; };
  document.addEventListener(EVT, event => {
    let msg;
    try { msg = JSON.parse(event.detail); } catch (_) { return; }
    if (msg?.type === 'state' && typeof msg.sid === 'string') {
      sid = msg.sid;
      snapshot = msg.completed === true && Array.isArray(msg.points) && msg.points.length >= 3
        ? msg.points.map(p => ({ lat: Number(p.lat), lng: Number(p.lng) })) : null;
    }
  });
  button.addEventListener('click', async () => {
    if (busy) return;
    if (!snapshot || !sid) { show('先に活動範囲を3点以上で確定してください。'); return; }
    if (!confirm('診断用にWayfarerへ1回だけ通信します。続行しますか？')) return;
    busy = true; button.disabled = true; show('通信中…');
    const requestId = 'i4-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    const resultEvent = 'cbs-i4:result';
    const handler = event => {
      let msg;
      try { msg = JSON.parse(event.detail); } catch (_) { return; }
      if (msg?.requestId !== requestId) return;
      document.removeEventListener(resultEvent, handler);
      clearTimeout(timeout);
      busy = false; button.disabled = false;
      show(JSON.stringify(msg.result, null, 2));
    };
    const timeout = setTimeout(() => {
      document.removeEventListener(resultEvent, handler);
      busy = false; button.disabled = false; show('TIMEOUT: 結果を受信できませんでした。');
    }, 15000);
    document.addEventListener(resultEvent, handler);
    document.dispatchEvent(new CustomEvent('cbs-i4:request', {
      detail: JSON.stringify({ requestId, polygon: snapshot })
    }));
  });
  document.documentElement.append(button, output);
})();
