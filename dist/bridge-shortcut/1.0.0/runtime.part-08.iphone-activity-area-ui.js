;(() => {
  'use strict';
  const ROOT_ID = 'cbs-iphone-area-editor';
  const CMD = 'cbs-i3:cmd';
  const EVT = 'cbs-i3:evt';
  const MAX_POINTS = 30;

  let root = null;
  let points = [];
  let completed = false;
  let mapBound = false;
  let lastError = '';
  let sid = '';

  function newSid() {
    try { return crypto.randomUUID(); } catch (_) {}
    return 'i3-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }

  function send(cmd, extra = {}) {
    if (!sid) return;
    document.dispatchEvent(new CustomEvent(CMD, {
      detail: JSON.stringify({ sid, cmd, ...extra })
    }));
  }

  function stateText() {
    if (lastError === 'MAP_UNAVAILABLE' || lastError === 'PROJECTION_UNAVAILABLE') {
      return '地図位置を確認できません。地図を少し動かしてから、もう一度押してください。';
    }
    if (lastError === 'TILT_HEADING') return '地図の傾き・回転を0にしてから、もう一度押してください。';
    if (lastError) return '活動範囲の描画でエラーが発生しました。';
    if (completed) return '範囲を確定しました。I3ではまだPOI取得は行いません。';
    if (!mapBound) return '地図を確認しています。少し待ってから頂点を追加してください。';
    if (!points.length) return '地図を動かし、中央の＋を1つ目の頂点に合わせてください。';
    if (points.length < 3) return `頂点 ${points.length}個。あと${3-points.length}個以上追加してください。`;
    return `頂点 ${points.length}個。必要なら追加し、範囲を確定してください。`;
  }

  function render() {
    if (!root) return;
    root.querySelector('[data-role="status"]').textContent = stateText();
    root.querySelector('[data-action="add"]').disabled = completed || points.length >= MAX_POINTS;
    root.querySelector('[data-action="undo"]').disabled = completed || points.length === 0;
    root.querySelector('[data-action="complete"]').disabled = completed || points.length < 3;
    root.querySelector('[data-role="crosshair"]').hidden = completed;
  }

  function onPageEvent(event) {
    let msg = null;
    try { msg = JSON.parse(event.detail); } catch (_) { return; }
    if (!msg || (msg.sid !== sid && msg.sid !== null)) return;
    if (msg.type === 'state') {
      points = Array.isArray(msg.points) ? msg.points.map(p => ({ lat:Number(p.lat), lng:Number(p.lng) })) : points;
      completed = Boolean(msg.completed);
      mapBound = Boolean(msg.mapBound);
      lastError = '';
      render();
    } else if (msg.type === 'map-bound') {
      mapBound = true; lastError = ''; render();
    } else if (msg.type === 'map-lost') {
      mapBound = false; render();
    } else if (msg.type === 'error') {
      lastError = String(msg.code || 'UNKNOWN'); render();
    }
  }

  function crosshairCenter() {
    const el = root?.querySelector('[data-role="crosshair"]');
    const rect = el?.getBoundingClientRect?.();
    if (!rect) return null;
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function addPoint() {
    const p = crosshairCenter();
    if (!p || completed || points.length >= MAX_POINTS) return;
    lastError = '';
    send('add', p);
  }

  function close() {
    if (sid) send('destroy');
    root?.remove();
    root = null;
    points = [];
    completed = false;
    mapBound = false;
    lastError = '';
    sid = '';
  }

  function open() {
    if (root?.isConnected) return;
    sid = newSid();
    points = [];
    completed = false;
    mapBound = false;
    lastError = '';

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
    root.querySelector('[data-action="add"]').addEventListener('click', addPoint);
    root.querySelector('[data-action="undo"]').addEventListener('click', () => send('undo'));
    root.querySelector('[data-action="restart"]').addEventListener('click', () => send('restart'));
    root.querySelector('[data-action="complete"]').addEventListener('click', () => send('complete'));
    root.querySelector('[data-action="close"]').addEventListener('click', close);
    render();
    send('get');
  }

  document.addEventListener(EVT, onPageEvent);
  document.getElementById('cbs-area-start')?.addEventListener('click', open);
  window.CampsiteBridgeIPhoneAreaPrototype = Object.freeze({
    open,
    getState: () => ({ points:points.map(p => ({...p})), completed, mapBound, lastError })
  });
})();