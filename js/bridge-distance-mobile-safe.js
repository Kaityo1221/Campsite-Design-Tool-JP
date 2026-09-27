(() => {
  'use strict';

  const params = new URLSearchParams(location.search);
  if (params.get('campsiteProject') !== 'bridge') return;

  const isIOSWebKit = /iP(?:hone|ad|od)/.test(navigator.userAgent || '') && /WebKit/.test(navigator.userAgent || '');
  if (!isIOSWebKit || typeof window.renderSimpleDistanceMap !== 'function') return;

  const originalRenderSimpleDistanceMap = window.renderSimpleDistanceMap;
  let pending = null;

  function layerName(point) {
    return String(point?.originalLayer || point?.layer || '');
  }

  function isAdded(point) {
    const layer = layerName(point);
    return point?.role === 'added' || /^new-/i.test(layer) || layer.includes('新規');
  }

  function mobileWarnings(warnings) {
    const list = Array.isArray(warnings) ? warnings.slice() : [];
    const actionable = list.filter(item => isAdded(item?.a) || isAdded(item?.b));
    const chosen = actionable.length ? actionable : list;
    return chosen
      .sort((a, b) => Number(a?.distance || 0) - Number(b?.distance || 0))
      .slice(0, 120);
  }

  function renderDeferredCard(mapElement, points, warnings) {
    mapElement.replaceChildren();
    mapElement.style.display = 'block';
    mapElement.style.height = 'auto';
    mapElement.style.minHeight = '0';
    mapElement.style.overflow = 'visible';
    mapElement.style.background = 'transparent';
    mapElement.style.border = '0';
    mapElement.style.boxShadow = 'none';

    const card = document.createElement('div');
    card.style.cssText = 'padding:14px;border:1px solid rgba(56,189,248,.32);border-radius:14px;background:rgba(14,165,233,.07);color:#dbeafe;text-align:center';

    const note = document.createElement('div');
    note.style.cssText = 'font-size:12px;line-height:1.7;color:#cbd5e1';
    note.textContent = 'iPhoneでは安定表示のため、距離チェックマップは必要なときだけ読み込みます。';

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '🗺 地図を表示';
    button.style.cssText = 'width:100%;min-height:48px;margin-top:10px;padding:12px 14px;border:1px solid rgba(56,189,248,.48);border-radius:12px;background:rgba(14,165,233,.16);color:#e0f2fe;font-size:15px;font-weight:900;cursor:pointer';

    button.addEventListener('click', () => {
      if (!pending) return;
      button.disabled = true;
      button.textContent = '地図を読み込んでいます…';

      const safeWarnings = mobileWarnings(pending.warnings);
      mapElement.style.height = '360px';
      mapElement.style.minHeight = '360px';
      mapElement.style.overflow = 'hidden';
      mapElement.style.background = '#020617';
      mapElement.style.border = '1px solid rgba(96,165,250,.35)';
      mapElement.style.boxShadow = '0 18px 36px rgba(0,0,0,.24)';

      requestAnimationFrame(() => {
        try {
          originalRenderSimpleDistanceMap(pending.points, safeWarnings);
        } catch (error) {
          console.error('[Campsite Project] mobile distance map failed', error);
          mapElement.style.height = 'auto';
          mapElement.style.minHeight = '0';
          mapElement.style.overflow = 'visible';
          mapElement.innerHTML = '<div style="padding:14px;color:#fecaca;line-height:1.7">⚠️ 地図を読み込めませんでした。距離チェック結果はそのまま利用できます。</div>';
        }
      });
    }, { once: true });

    card.append(note, button);
    mapElement.appendChild(card);
  }

  window.renderSimpleDistanceMap = function renderSimpleDistanceMapMobileSafe(points = [], warnings = []) {
    pending = {
      points: Array.isArray(points) ? points.slice() : [],
      warnings: Array.isArray(warnings) ? warnings.slice() : []
    };

    const mapElement = document.getElementById('distanceMap');
    if (!mapElement) return;
    renderDeferredCard(mapElement, pending.points, pending.warnings);
  };
})();
