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

  function isReferencePair(warning) {
    try {
      if (typeof window.isExistingPoiPair === 'function') return window.isExistingPoiPair(warning);
    } catch (_) {}
    return !isAdded(warning?.a) && !isAdded(warning?.b);
  }

  function riskType(warning) {
    const type = String(warning?.type || '軽微');
    if (type === '密集' || type === '滞留') return type;
    return '軽微';
  }

  function esc(value) {
    try {
      if (typeof window.escapeDistanceHtml === 'function') return window.escapeDistanceHtml(String(value ?? ''));
    } catch (_) {}
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function mobileWarnings(warnings) {
    const list = Array.isArray(warnings) ? warnings.slice() : [];
    const actionable = list.filter(item => isAdded(item?.a) || isAdded(item?.b));
    const chosen = actionable.length ? actionable : list;
    return chosen
      .sort((a, b) => Number(a?.distance || 0) - Number(b?.distance || 0))
      .slice(0, 120);
  }

  function installLightweightRiskRenderer() {
    if (typeof window.getRiskAccordionHtml !== 'function') return;

    window.getRiskAccordionHtml = function getRiskAccordionHtmlMobileSafe(warnings = []) {
      const groups = {
        '密集': { target: [], reference: [] },
        '滞留': { target: [], reference: [] },
        '軽微': { target: [], reference: [] }
      };

      for (const warning of Array.isArray(warnings) ? warnings : []) {
        const type = riskType(warning);
        const bucket = isReferencePair(warning) ? groups[type].reference : groups[type].target;
        bucket.push(warning);
      }

      const settings = {
        '密集': { icon: '🔴', color: '#ef4444', label: '密集（20m未満）' },
        '滞留': { icon: '🟠', color: '#f97316', label: '滞留（20m以上30m未満）' },
        '軽微': { icon: '⚪', color: '#94a3b8', label: '参考距離（30m以上50m未満）' }
      };

      const renderTargetCard = warning => {
        const type = riskType(warning);
        const setting = settings[type];
        const distance = Number(warning?.distance);
        return `
          <div style="margin:8px 0;padding:9px 10px;border-radius:10px;background:rgba(15,23,42,.65);border:1px solid rgba(148,163,184,.25)">
            <strong style="color:${setting.color}">${type === '軽微' ? '△ 参考距離' : '⚠ 調整対象'}（${Number.isFinite(distance) ? distance.toFixed(1) : '-'}m）</strong><br>
            ${esc(warning?.a?.layer)}：${esc(warning?.a?.name)}<br>
            × ${esc(warning?.b?.layer)}：${esc(warning?.b?.name)}
          </div>`;
      };

      let advice = '';
      try {
        if (typeof window.getDistanceActionableAdviceHtml === 'function') advice = window.getDistanceActionableAdviceHtml(warnings) || '';
      } catch (_) {}

      const sections = Object.keys(groups).map(type => {
        const setting = settings[type];
        const target = groups[type].target.slice().sort((a, b) => Number(a?.distance || 0) - Number(b?.distance || 0));
        const referenceCount = groups[type].reference.length;
        const shown = target.slice(0, 12);
        const hiddenCount = Math.max(0, target.length - shown.length);
        return `
          <details style="margin-bottom:10px;padding:10px 12px 9px 14px;border-radius:12px;background:rgba(15,23,42,.45);border:1px solid rgba(148,163,184,.22);border-left:5px solid ${setting.color}">
            <summary style="cursor:pointer;font-weight:bold;color:${setting.color};font-size:15px;line-height:1.45">
              ${setting.icon} ${setting.label}（${target.length + referenceCount}件）
            </summary>
            <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(148,163,184,.18);font-size:12px;line-height:1.7;color:#cbd5e1">
              調整・確認対象：${target.length}件 / 参考：既存POI同士 ${referenceCount}件
            </div>
            ${shown.map(renderTargetCard).join('')}
            ${hiddenCount ? `<div style="margin:8px 0;color:#cbd5e1;font-size:12px">ほか ${hiddenCount}件の候補があります。</div>` : ''}
            ${referenceCount ? `<div style="margin:8px 0;padding:9px 10px;border-radius:10px;background:rgba(148,163,184,.08);color:#cbd5e1;font-size:12px;line-height:1.7">ℹ 既存POI同士の近接 ${referenceCount}件は参考情報のため、件数のみ表示しています。</div>` : ''}
          </details>`;
      }).join('');

      return `${advice}<div class="distance-warning">${sections}</div>`;
    };
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

  installLightweightRiskRenderer();

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
