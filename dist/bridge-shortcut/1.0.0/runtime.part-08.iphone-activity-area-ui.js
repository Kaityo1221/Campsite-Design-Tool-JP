;(() => {
  'use strict';
  const ROOT_ID = 'cbs-iphone-area-editor';
  const MAX_POINTS = 30;
  let points = [];
  let completed = false;
  let root = null;
  let line = null;
  let polygon = null;

  function map() {
    const candidates = [
      window.__campsiteBridgeGoogleMap,
      (() => { try { return window.WFMM?.map?.get?.() || null; } catch (_) { return null; } })()
    ];
    return candidates.find(value => value && typeof value.getCenter === 'function' && typeof value.addListener === 'function') || null;
  }

  function clearOverlay() {
    try { line?.setMap?.(null); } catch (_) {}
    try { polygon?.setMap?.(null); } catch (_) {}
    line = null; polygon = null;
  }

  function draw() {
    clearOverlay();
    const m = map();
    const maps = window.google?.maps;
    if (!m || !maps || !points.length) return;
    if (points.length >= 3) {
      polygon = new maps.Polygon({
        map:m, paths:points, clickable:false,
        strokeColor:'#2563eb', strokeOpacity:0.95, strokeWeight:3,
        fillColor:'#60a5fa', fillOpacity:0.16
      });
    } else if (points.length >= 2) {
      line = new maps.Polyline({
        map:m, path:points, clickable:false,
        strokeColor:'#2563eb', strokeOpacity:0.95, strokeWeight:3
      });
    }
  }

  function stateText() {
    if (completed) return '範囲を確定しました。I3ではまだPOI取得は行いません。';
    if (!points.length) return '地図を動かし、中央の＋を1つ目の頂点に合わせてください。';
    if (points.length < 3) return `頂点 ${points.length}個。あと${3-points.length}個以上追加してください。`;
    return `頂点 ${points.length}個。必要なら追加し、範囲を確定してください。`;
  }

  function render() {
    if (!root) return;
    root.querySelector('[data-role="status"]').textContent = stateText();
    root.querySelector('[data-action="add"]').disabled = completed || points.length >= MAX_POINTS || !map();
    root.querySelector('[data-action="undo"]').disabled = completed || points.length === 0;
    root.querySelector('[data-action="complete"]').disabled = completed || points.length < 3;
    root.querySelector('[data-role="crosshair"]').hidden = completed;
    draw();
  }

  function addCenter() {
    const m = map();
    const center = m?.getCenter?.();
    if (!center || completed || points.length >= MAX_POINTS) return;
    const lat = Number(typeof center.lat === 'function' ? center.lat() : center.lat);
    const lng = Number(typeof center.lng === 'function' ? center.lng() : center.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    points.push({lat,lng});
    render();
  }

  function undo() { if (!completed && points.length) { points.pop(); render(); } }
  function restart() { points = []; completed = false; render(); }
  function complete() { if (points.length >= 3) { completed = true; render(); } }

  function close() {
    root?.remove();
    root = null;
    clearOverlay();
  }

  function open() {
    if (root?.isConnected) return;
    root = document.createElement('div');
    root.id = ROOT_ID;
    root.innerHTML = `
      <div data-role="crosshair" aria-hidden="true" style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2147483645;pointer-events:none;width:34px;height:34px;display:grid;place-items:center;font:900 32px/1 -apple-system,BlinkMacSystemFont,sans-serif;color:#0f172a;text-shadow:0 0 3px #fff,0 0 3px #fff">＋</div>
      <section style="position:fixed;left:12px;right:12px;bottom:max(16px,env(safe-area-inset-bottom));z-index:2147483646;max-width:440px;margin:auto;padding:12px;border-radius:16px;background:rgba(15,23,42,.96);color:#fff;font:12px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;box-shadow:0 12px 36px rgba(0,0,0,.38);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><strong style="font-size:15px">📍 活動範囲を決める</strong><button data-action="close" style="border:0;background:transparent;color:#fff;font-size:22px">×</button></div>
        <div data-role="status" style="margin:8px 0;padding:8px;border-radius:9px;background:rgba(30,41,59,.9)"></div>
        <button data-action="add" style="width:100%;padding:11px;border:0;border-radius:10px;background:#dbeafe;color:#1e3a8a;font-weight:900">＋ 頂点を追加</button>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:7px">
          <button data-action="undo" style="padding:9px;border:0;border-radius:9px;font-weight:800">↶ 1つ戻す</button>
          <button data-action="restart" style="padding:9px;border:0;border-radius:9px;font-weight:800">最初からやり直す</button>
        </div>
        <button data-action="complete" style="width:100%;margin-top:7px;padding:11px;border:0;border-radius:10px;background:#dcfce7;color:#14532d;font-weight:900">範囲を確定</button>
      </section>`;
    document.documentElement.appendChild(root);
    root.querySelector('[data-action="add"]').addEventListener('click', addCenter);
    root.querySelector('[data-action="undo"]').addEventListener('click', undo);
    root.querySelector('[data-action="restart"]').addEventListener('click', restart);
    root.querySelector('[data-action="complete"]').addEventListener('click', complete);
    root.querySelector('[data-action="close"]').addEventListener('click', close);
    render();
  }

  document.getElementById('cbs-area-start')?.addEventListener('click', open);
  window.CampsiteBridgeIPhoneAreaPrototype = Object.freeze({
    open,
    getState: () => ({ points:points.map(p => ({...p})), completed })
  });
})();