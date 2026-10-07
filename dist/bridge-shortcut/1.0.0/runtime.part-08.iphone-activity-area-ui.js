;(() => {
  'use strict';
  const ROOT_ID = 'cbs-iphone-area-editor';
  const MAX_POINTS = 30;
  let points = [];
  let completed = false;
  let root = null;
  let line = null;
  let polygon = null;
  let svgOverlay = null;
  let redrawTimer = null;

  function map() {
    const candidates = [
      (() => { try { return window.CampsiteBridgeIPhoneRecovery?.getMap?.() || null; } catch (_) { return null; } })(),
      (() => { try { return window.CampsiteBridgeShortcut?.getMap?.() || null; } catch (_) { return null; } })(),
      window.__campsiteBridgeGoogleMap,
      (() => { try { return window.WFMM?.map?.get?.() || null; } catch (_) { return null; } })()
    ];
    return candidates.find(value => value && typeof value.getCenter === 'function' && typeof value.addListener === 'function') || null;
  }

  function clearOverlay() {
    try { line?.setMap?.(null); } catch (_) {}
    try { polygon?.setMap?.(null); } catch (_) {}
    line = null; polygon = null;
    svgOverlay?.remove();
    svgOverlay = null;
  }

  function mercatorY(lat) {
    const safe = Math.max(-85.05112878, Math.min(85.05112878, Number(lat)));
    const rad = safe * Math.PI / 180;
    return Math.log(Math.tan(Math.PI / 4 + rad / 2));
  }

  function mapRect() {
    const gm = document.querySelector('.gm-style');
    const host = gm?.parentElement || gm;
    const rect = host?.getBoundingClientRect?.();
    if (rect && rect.width > 40 && rect.height > 40) return rect;
    return null;
  }


  function drawFixedScreenVertices() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${innerWidth} ${innerHeight}`);
    svg.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483644;pointer-events:none;overflow:hidden';
    const xy = points.map(p => ({x:Number(p.screenX), y:Number(p.screenY)}));
    if (xy.length >= 2) {
      const shape = document.createElementNS(ns, xy.length >= 3 ? 'polygon' : 'polyline');
      shape.setAttribute('points', xy.map(p => `${p.x},${p.y}`).join(' '));
      shape.setAttribute('fill', xy.length >= 3 ? 'rgba(96,165,250,.18)' : 'none');
      shape.setAttribute('stroke', '#2563eb');
      shape.setAttribute('stroke-width', '4');
      shape.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(shape);
    }
    xy.forEach((p,i) => {
      const dot = document.createElementNS(ns,'circle');
      dot.setAttribute('cx',String(p.x)); dot.setAttribute('cy',String(p.y));
      dot.setAttribute('r','9'); dot.setAttribute('fill','#fff');
      dot.setAttribute('stroke','#2563eb'); dot.setAttribute('stroke-width','5');
      svg.appendChild(dot);
      const label = document.createElementNS(ns,'text');
      label.setAttribute('x',String(p.x)); label.setAttribute('y',String(p.y-15));
      label.setAttribute('text-anchor','middle'); label.setAttribute('fill','#0f172a');
      label.setAttribute('stroke','#fff'); label.setAttribute('stroke-width','4');
      label.setAttribute('paint-order','stroke'); label.setAttribute('font-size','14');
      label.setAttribute('font-weight','900'); label.textContent=String(i+1);
      svg.appendChild(label);
    });
    document.documentElement.appendChild(svg);
    svgOverlay=svg;
    return true;
  }

  function drawScreenOverlay() {
    svgOverlay?.remove();
    svgOverlay = null;
    if (!points.length || !root?.isConnected) return false;
    const screenReady = points.every(p => Number.isFinite(p.screenX) && Number.isFinite(p.screenY));
    const bounds = window.CampsiteBridgeIPhoneRecovery?.getState?.()?.latestRangeBounds;
    const rect = mapRect();
    const south = Number(bounds?.swLat), north = Number(bounds?.neLat);
    const west = Number(bounds?.swLng), east = Number(bounds?.neLng);
    if (screenReady) {
      return drawFixedScreenVertices();
    }
    if (!rect || ![south,north,west,east].every(Number.isFinite)) return false;
    const ySouth = mercatorY(south), yNorth = mercatorY(north);
    const lngSpan = east >= west ? east - west : east + 360 - west;
    if (!(lngSpan > 0) || yNorth === ySouth) return false;
    const xy = points.map(p => {
      let lng = Number(p.lng);
      if (east < west && lng < west) lng += 360;
      return {
        x: rect.left + ((lng - west) / lngSpan) * rect.width,
        y: rect.top + ((yNorth - mercatorY(p.lat)) / (yNorth - ySouth)) * rect.height
      };
    });
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${innerWidth} ${innerHeight}`);
    svg.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483644;pointer-events:none;overflow:hidden';
    if (xy.length >= 2) {
      const shape = document.createElementNS(ns, xy.length >= 3 ? 'polygon' : 'polyline');
      shape.setAttribute('points', xy.map(p => `${p.x},${p.y}`).join(' '));
      shape.setAttribute('fill', xy.length >= 3 ? 'rgba(96,165,250,.18)' : 'none');
      shape.setAttribute('stroke', '#2563eb');
      shape.setAttribute('stroke-width', '4');
      shape.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(shape);
    }
    xy.forEach((p, i) => {
      const dot = document.createElementNS(ns, 'circle');
      dot.setAttribute('cx', String(p.x)); dot.setAttribute('cy', String(p.y));
      dot.setAttribute('r', '7'); dot.setAttribute('fill', '#ffffff');
      dot.setAttribute('stroke', '#2563eb'); dot.setAttribute('stroke-width', '4');
      svg.appendChild(dot);
      const label = document.createElementNS(ns, 'text');
      label.setAttribute('x', String(p.x)); label.setAttribute('y', String(p.y - 12));
      label.setAttribute('text-anchor', 'middle'); label.setAttribute('fill', '#0f172a');
      label.setAttribute('stroke', '#ffffff'); label.setAttribute('stroke-width', '3');
      label.setAttribute('paint-order', 'stroke'); label.setAttribute('font-size', '13');
      label.setAttribute('font-weight', '800'); label.textContent = String(i + 1);
      svg.appendChild(label);
    });
    document.documentElement.appendChild(svg);
    svgOverlay = svg;
    return true;
  }

  function draw() {
    clearOverlay();
    const m = map();
    const maps = window.google?.maps;
    if (!points.length) return;
    if (!m || !maps) {
      drawScreenOverlay();
      return;
    }
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
    root.querySelector('[data-action="add"]').disabled = completed || points.length >= MAX_POINTS;
    root.querySelector('[data-action="undo"]').disabled = completed || points.length === 0;
    root.querySelector('[data-action="complete"]').disabled = completed || points.length < 3;
    root.querySelector('[data-role="crosshair"]').hidden = completed;
    draw();
  }

  function addCenter() {
    if (completed || points.length >= MAX_POINTS) return;
    const m = map();
    const center = m?.getCenter?.();
    let lat = Number(center && (typeof center.lat === 'function' ? center.lat() : center.lat));
    let lng = Number(center && (typeof center.lng === 'function' ? center.lng() : center.lng));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      const bounds = window.CampsiteBridgeIPhoneRecovery?.getState?.()?.latestRangeBounds;
      const south = Number(bounds?.swLat);
      const north = Number(bounds?.neLat);
      const west = Number(bounds?.swLng);
      const east = Number(bounds?.neLng);
      if ([south,north,west,east].every(Number.isFinite)) {
        lat = (south + north) / 2;
        lng = west <= east ? (west + east) / 2 : ((((west + 360) + east) / 2 + 540) % 360) - 180;
      }
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      const status = root?.querySelector('[data-role="status"]');
      if (status) status.textContent = '地図位置を確認できません。地図を少し動かしてから、もう一度押してください。';
      return;
    }
    points.push({lat,lng, screenX: innerWidth / 2, screenY: innerHeight / 2});
    render();
  }

  function undo() { if (!completed && points.length) { points.pop(); render(); } }
  function restart() { points = []; completed = false; render(); }
  function complete() { if (points.length >= 3) { completed = true; render(); } }

  function close() {
    root?.remove();
    root = null;
    if (redrawTimer) clearInterval(redrawTimer);
    redrawTimer = null;
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
    if (redrawTimer) clearInterval(redrawTimer);
    redrawTimer = setInterval(() => {
      if (!root?.isConnected) return;
      if (!map()) drawScreenOverlay();
    }, 500);
  }

  document.getElementById('cbs-area-start')?.addEventListener('click', open);
  window.CampsiteBridgeIPhoneAreaPrototype = Object.freeze({
    open,
    getState: () => ({ points:points.map(p => ({...p})), completed })
  });
})();