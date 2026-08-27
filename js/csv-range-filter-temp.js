(() => {
  'use strict';

  const INPUT_ID = 'fileInput';
  const BRIDGE_PREFIX = 'campsite_bridge_';
  let modal = null;
  let map = null;
  let markerLayer = null;
  let rectangle = null;
  let firstCorner = null;
  let sourcePoints = [];
  let filteredPoints = [];

  function injectStyles() {
    if (document.getElementById('csvRangeFilterTempStyle')) return;
    const style = document.createElement('style');
    style.id = 'csvRangeFilterTempStyle';
    style.textContent = `
      .csv-range-temp-modal{position:fixed;inset:0;z-index:2147483000;background:rgba(2,6,23,.86);display:flex;align-items:center;justify-content:center;padding:14px}
      .csv-range-temp-card{width:min(760px,100%);max-height:92vh;overflow:auto;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:18px;padding:16px;box-shadow:0 24px 80px rgba(0,0,0,.45)}
      .csv-range-temp-card h3{margin:0 0 6px;font-size:18px}.csv-range-temp-note{font-size:12px;line-height:1.6;color:#94a3b8;margin-bottom:10px}
      #csvRangeTempMap{height:min(58vh,520px);min-height:340px;border-radius:14px;overflow:hidden;background:#111827}
      .csv-range-temp-counts{display:flex;gap:14px;flex-wrap:wrap;margin:12px 0;font-size:13px}.csv-range-temp-counts strong{color:#86efac}
      .csv-range-temp-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}.csv-range-temp-actions button{border:0;border-radius:12px;padding:12px;font-weight:800;cursor:pointer}
      .csv-range-temp-apply{background:#22c55e;color:#052e16}.csv-range-temp-cancel{background:#334155;color:#e2e8f0}
      .csv-range-temp-reset{width:100%;margin:8px 0 12px;border:1px solid #475569;background:#111827;color:#e2e8f0;border-radius:10px;padding:9px;font-weight:700}
      @media(max-width:600px){#csvRangeTempMap{height:52vh;min-height:320px}.csv-range-temp-card{padding:12px}.csv-range-temp-actions{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function escapeCsv(value) {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function buildCsv(points) {
    const rows = [['title','lat','lng','gameEntity','gameStatus','guid']];
    for (const p of points) {
      rows.push([
        p.name || p.title || '',
        p.lat,
        p.lng,
        String(p.type || p.gameEntity || '').toUpperCase(),
        String(p.gameStatus || 'ACTIVE').toUpperCase(),
        p.guid || ''
      ]);
    }
    return rows.map(row => row.map(escapeCsv).join(',')).join('\r\n');
  }

  function closeModal() {
    if (map) {
      map.remove();
      map = null;
    }
    modal?.remove();
    modal = null;
    markerLayer = null;
    rectangle = null;
    firstCorner = null;
    sourcePoints = [];
    filteredPoints = [];
  }

  function updateCounts() {
    const total = modal?.querySelector('#csvRangeTempTotal');
    const inside = modal?.querySelector('#csvRangeTempInside');
    const outside = modal?.querySelector('#csvRangeTempOutside');
    if (!total) return;
    total.textContent = sourcePoints.length;
    inside.textContent = filteredPoints.length;
    outside.textContent = Math.max(0, sourcePoints.length - filteredPoints.length);
  }

  function resetSelection() {
    firstCorner = null;
    filteredPoints = [];
    if (rectangle && map) map.removeLayer(rectangle);
    rectangle = null;
    updateCounts();
    const msg = modal?.querySelector('#csvRangeTempMessage');
    if (msg) msg.textContent = '地図上で対象エリアの角を2か所タップしてください。';
  }

  function selectBounds(a, b) {
    const south = Math.min(a.lat, b.lat);
    const north = Math.max(a.lat, b.lat);
    const west = Math.min(a.lng, b.lng);
    const east = Math.max(a.lng, b.lng);
    filteredPoints = sourcePoints.filter(p =>
      p.lat >= south && p.lat <= north && p.lng >= west && p.lng <= east
    );
    if (rectangle) map.removeLayer(rectangle);
    rectangle = L.rectangle([[south, west], [north, east]], {
      weight: 3,
      fillOpacity: 0.08
    }).addTo(map);
    updateCounts();
    const msg = modal.querySelector('#csvRangeTempMessage');
    msg.textContent = `この四角を使いますか？ 範囲内 ${filteredPoints.length}件 / 範囲外 ${sourcePoints.length - filteredPoints.length}件`;
  }

  function showModal(points) {
    injectStyles();
    sourcePoints = points.filter(p => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))).map(p => ({...p, lat:Number(p.lat), lng:Number(p.lng)}));
    filteredPoints = [];

    modal = document.createElement('div');
    modal.className = 'csv-range-temp-modal';
    modal.innerHTML = `
      <div class="csv-range-temp-card" role="dialog" aria-modal="true" aria-label="CSV抽出範囲 暫定">
        <h3>📐 CSV抽出範囲（暫定）</h3>
        <div class="csv-range-temp-note">別地域のPOIが混ざる場合の暫定対策です。対象エリアを四角で囲みます。ここで作る四角はKMZにも保存せず、処理後に破棄します。</div>
        <div id="csvRangeTempMessage" class="csv-range-temp-note">地図上で対象エリアの角を2か所タップしてください。</div>
        <div id="csvRangeTempMap"></div>
        <div class="csv-range-temp-counts">
          <span>CSV全体 <strong id="csvRangeTempTotal">0</strong>件</span>
          <span>範囲内 <strong id="csvRangeTempInside">0</strong>件</span>
          <span>範囲外 <strong id="csvRangeTempOutside">0</strong>件</span>
        </div>
        <button class="csv-range-temp-reset" type="button" id="csvRangeTempReset">四角を引き直す</button>
        <div class="csv-range-temp-actions">
          <button class="csv-range-temp-cancel" type="button" id="csvRangeTempCancel">今回は使わない</button>
          <button class="csv-range-temp-apply" type="button" id="csvRangeTempApply">この範囲だけ使う</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    map = L.map('csvRangeTempMap', { zoomControl:true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    markerLayer = L.layerGroup().addTo(map);
    const latlngs = [];
    for (const p of sourcePoints) {
      const ll = [p.lat, p.lng];
      latlngs.push(ll);
      L.circleMarker(ll, { radius:4, weight:1, fillOpacity:.75 }).bindTooltip(p.name || p.title || '', {direction:'top'}).addTo(markerLayer);
    }
    if (latlngs.length) map.fitBounds(latlngs, { padding:[24,24], maxZoom:17 });

    map.on('click', event => {
      if (!firstCorner) {
        firstCorner = event.latlng;
        const msg = modal.querySelector('#csvRangeTempMessage');
        msg.textContent = '1点目を設定しました。反対側の角をタップしてください。';
        return;
      }
      selectBounds(firstCorner, event.latlng);
      firstCorner = null;
    });

    modal.querySelector('#csvRangeTempReset').addEventListener('click', resetSelection);
    modal.querySelector('#csvRangeTempCancel').addEventListener('click', closeModal);
    modal.querySelector('#csvRangeTempApply').addEventListener('click', () => {
      if (!rectangle || !filteredPoints.length) {
        alert('先に対象範囲を四角で囲んでください。');
        return;
      }
      const input = document.getElementById(INPUT_ID);
      if (!input) return;
      const csv = buildCsv(filteredPoints);
      const file = new File([csv], `campsite_range_filtered_${filteredPoints.length}.csv`, {type:'text/csv;charset=utf-8'});
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', {bubbles:true}));
      const status = document.getElementById('status');
      if (status) {
        status.innerHTML = `📐 抽出範囲を適用しました<br>元データ：${sourcePoints.length}件 / 使用：${filteredPoints.length}件 / 除外：${sourcePoints.length-filteredPoints.length}件`;
      }
      closeModal();
    });

    updateCounts();
    setTimeout(() => map?.invalidateSize(), 50);
  }

  async function handleFiles(input) {
    const files = Array.from(input.files || []);
    if (!files.length) return;
    if (files.some(f => String(f.name || '').toLowerCase().startsWith(BRIDGE_PREFIX))) return;
    if (files.some(f => !String(f.name || '').toLowerCase().endsWith('.csv'))) return;
    if (files.length === 1 && String(files[0].name || '').startsWith('campsite_range_filtered_')) return;
    if (typeof window.parseCSV !== 'function' || typeof window.L === 'undefined') return;

    const points = [];
    for (const file of files) {
      try {
        const text = await file.text();
        points.push(...window.parseCSV(text));
      } catch (error) {
        console.warn('[CSV range temp] CSV parse failed', error);
      }
    }
    if (points.length) showModal(points);
  }

  function start() {
    const input = document.getElementById(INPUT_ID);
    if (!input) {
      setTimeout(start, 300);
      return;
    }
    input.addEventListener('change', () => handleFiles(input));
    window.CampsiteCsvRangeFilterTemp = Object.freeze({
      version:'0.1-temp',
      close:closeModal
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, {once:true});
  } else {
    start();
  }
})();
