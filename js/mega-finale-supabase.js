const MEGA_FINALE_SUPABASE_URL = "https://azkshxjgsbtjgwbapcfw.supabase.co";
const MEGA_FINALE_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_rWbeIqdWJJHHBtphER8bdg__CaS_xGK";

window.megaFinaleSupabase = (window.supabase && typeof window.supabase.createClient === "function")
  ? window.supabase.createClient(MEGA_FINALE_SUPABASE_URL, MEGA_FINALE_SUPABASE_PUBLISHABLE_KEY)
  : null;

(() => {
  let nearbyExistingLayer = null;
  let nearbyRadiusLayer = null;
  let nearbyStatus = null;
  let requestSeq = 0;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const typeLabel = (t) => ({
    pokestop: 'ポケストップ',
    gym: 'ジム',
    power_spot: 'パワースポット'
  }[t] || '既存スポット');

  function ensureStatus() {
    if (nearbyStatus) return nearbyStatus;
    const manual = document.getElementById('manual');
    if (!manual) return null;
    nearbyStatus = document.createElement('div');
    nearbyStatus.id = 'nearbyExistingStatus';
    nearbyStatus.style.marginTop = '10px';
    nearbyStatus.style.padding = '10px 12px';
    nearbyStatus.style.borderRadius = '12px';
    nearbyStatus.style.background = '#f7f8fa';
    nearbyStatus.style.border = '1px solid #e5e7eb';
    nearbyStatus.style.fontSize = '13px';
    nearbyStatus.style.lineHeight = '1.55';
    nearbyStatus.textContent = '新規地点を追加すると、周辺3kmの既存スポットをデータベースから表示します。';
    manual.appendChild(nearbyStatus);
    return nearbyStatus;
  }

  function ensureLayers() {
    try {
      if (typeof map === 'undefined' || !map || typeof L === 'undefined') return false;
      if (!nearbyExistingLayer) nearbyExistingLayer = L.layerGroup().addTo(map);
      return true;
    } catch {
      return false;
    }
  }

  function existingStyle(type) {
    if (type === 'gym') return { radius: 5, color: '#6b7280', weight: 2, fillColor: '#f59e0b', fillOpacity: .55 };
    if (type === 'pokestop') return { radius: 5, color: '#6b7280', weight: 2, fillColor: '#60a5fa', fillOpacity: .55 };
    if (type === 'power_spot') return { radius: 5, color: '#6b7280', weight: 2, fillColor: '#a78bfa', fillOpacity: .55 };
    return { radius: 4, color: '#6b7280', weight: 2, fillColor: '#9ca3af', fillOpacity: .5 };
  }

  function fitNearbyArea() {
    if (!nearbyRadiusLayer || typeof map === 'undefined' || !map) return;
    try {
      map.invalidateSize();
      map.fitBounds(nearbyRadiusLayer.getBounds(), {
        padding: [18, 18],
        animate: true,
        maxZoom: 14
      });
    } catch (e) {
      console.warn('nearby area fit failed', e);
    }
  }

  async function loadNearbyExistingPois(lat, lng) {
    const seq = ++requestSeq;
    const status = ensureStatus();
    if (status) status.textContent = '周辺3kmの既存スポットを読み込み中…';

    if (!window.megaFinaleSupabase) {
      if (status) status.textContent = '既存スポットのデータベースに接続できませんでした。';
      return;
    }

    const { data, error } = await window.megaFinaleSupabase.rpc('mega_finale_nearby_pois', {
      p_lat: lat,
      p_lng: lng,
      p_radius_m: 3000
    });
    if (seq !== requestSeq) return;

    if (error) {
      console.error('nearby existing POI load failed', error);
      if (status) status.textContent = '既存スポットを読み込めませんでした。新規地点はそのまま作成できます。';
      return;
    }

    const draw = () => {
      if (!ensureLayers()) {
        setTimeout(draw, 100);
        return;
      }

      nearbyExistingLayer.clearLayers();
      if (nearbyRadiusLayer) {
        try { map.removeLayer(nearbyRadiusLayer); } catch {}
      }
      nearbyRadiusLayer = L.circle([lat, lng], {
        radius: 3000,
        color: '#64748b',
        weight: 1,
        dashArray: '5 6',
        fillColor: '#94a3b8',
        fillOpacity: .025,
        interactive: false
      }).addTo(map);

      (data || []).forEach(p => {
        const m = L.circleMarker([p.sample_lat, p.sample_lng], existingStyle(p.poi_type));
        m.bindPopup(
          `<div style="font-weight:900;margin-bottom:5px">既存｜${esc(p.canonical_name)}</div>` +
          `<div style="font-size:12px;color:#6b7280">${esc(typeLabel(p.poi_type))}<br>${Number(p.sample_lat).toFixed(6)},${Number(p.sample_lng).toFixed(6)}<br>中心から約${Math.round(Number(p.distance_m))}m</div>`
        );
        m.addTo(nearbyExistingLayer);
      });

      if (status) status.innerHTML = `<b>既存スポット ${data?.length || 0}件</b>を周辺3kmから表示中。<br><span style="color:#6b7280">地図は3km全体が見える縮尺に自動調整します。薄い小さなマーカーが既存です。</span>`;

      fitNearbyArea();
      setTimeout(fitNearbyArea, 250);
      setTimeout(fitNearbyArea, 650);
    };
    draw();
  }

  window.loadMegaFinaleNearbyExistingPois = loadNearbyExistingPois;

  window.addEventListener('DOMContentLoaded', () => {
    ensureStatus();
    const add = document.getElementById('addManual');
    if (!add) return;

    add.addEventListener('click', () => {
      const lat = Number(document.getElementById('mLat')?.value);
      const lng = Number(document.getElementById('mLng')?.value);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
      setTimeout(() => loadNearbyExistingPois(lat, lng), 80);
    }, true);
  });
})();

(() => {
  function addWizardBackButton() {
    const wizard = document.getElementById('wizard');
    if (!wizard || wizard.querySelector('.mega-wizard-back')) return;
    const qText = wizard.querySelector('.muted')?.textContent || '';
    const match = qText.match(/Q\s*(\d+)\s*\/\s*(\d+)/i);
    if (!match) return;

    const current = Number(match[1]);
    const wrap = document.createElement('div');
    wrap.style.marginTop = '12px';
    wrap.style.display = 'flex';
    wrap.style.justifyContent = 'flex-start';

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'mega-wizard-back';
    back.textContent = '← 戻る';
    back.style.border = '1px solid #e5e7eb';
    back.style.background = current <= 1 ? '#f3f4f6' : '#fff';
    back.style.color = current <= 1 ? '#9ca3af' : '#374151';
    back.style.borderRadius = '12px';
    back.style.padding = '10px 14px';
    back.style.fontWeight = '900';
    back.style.cursor = current <= 1 ? 'default' : 'pointer';
    back.disabled = current <= 1;

    back.addEventListener('click', () => {
      if (current <= 1) return;
      try {
        qi = Math.max(0, qi - 1);
        ans = ans.slice(0, qi);
        const messageArea = document.getElementById('messageArea');
        if (messageArea) messageArea.style.display = 'none';
        drawWizard();
      } catch (e) {
        console.error('wizard back failed', e);
      }
    });

    wrap.appendChild(back);
    wizard.appendChild(wrap);
  }

  window.addEventListener('DOMContentLoaded', () => {
    const wizard = document.getElementById('wizard');
    if (!wizard) return;
    const observer = new MutationObserver(() => queueMicrotask(addWizardBackButton));
    observer.observe(wizard, { childList: true, subtree: true });
    addWizardBackButton();
  });
})();
