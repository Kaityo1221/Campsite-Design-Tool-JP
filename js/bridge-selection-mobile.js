(() => {
  'use strict';

  const params = new URLSearchParams(location.search);
  if (params.get('campsiteBridgeImport') !== '1') return;

  const ua = String(navigator.userAgent || '');
  const platform = String(navigator.platform || '');
  const touchPoints = Number(navigator.maxTouchPoints || 0);
  const isAppleTouch = /iPhone|iPad|iPod/i.test(ua) || (platform === 'MacIntel' && touchPoints > 1);
  const isMobile = isAppleTouch || /Android/i.test(ua);
  if (!isMobile) return;

  if (window.__campsiteBridgeMobileSelectionInstalled) return;
  window.__campsiteBridgeMobileSelectionInstalled = true;

  let bridgeMap = null;
  let configured = false;

  function captureBridgeMapFactory() {
    if (!window.L?.map || window.__campsiteBridgeMobileMapFactoryPatched) return;
    window.__campsiteBridgeMobileMapFactoryPatched = true;
    const originalMapFactory = window.L.map;
    window.L.map = function (...args) {
      const instance = originalMapFactory.apply(this, args);
      try {
        if (instance?.getContainer?.()?.id === 'campsiteBridgeMap') bridgeMap = instance;
      } catch (_) {}
      return instance;
    };
  }

  function injectStyles() {
    if (document.getElementById('campsiteBridgeMobileSelectionStyles')) return;
    const style = document.createElement('style');
    style.id = 'campsiteBridgeMobileSelectionStyles';
    style.textContent = `
      #campsiteBridgeMap .bridge-mobile-crosshair{
        position:absolute;left:50%;top:50%;z-index:900;width:34px;height:34px;
        transform:translate(-50%,-50%);pointer-events:none;filter:drop-shadow(0 1px 3px rgba(2,6,23,.8));
      }
      #campsiteBridgeMap .bridge-mobile-crosshair::before,
      #campsiteBridgeMap .bridge-mobile-crosshair::after{
        content:'';position:absolute;left:50%;top:50%;background:#f8fafc;border-radius:999px;
        box-shadow:0 0 0 1px rgba(2,6,23,.75);
      }
      #campsiteBridgeMap .bridge-mobile-crosshair::before{width:2px;height:34px;transform:translate(-50%,-50%)}
      #campsiteBridgeMap .bridge-mobile-crosshair::after{width:34px;height:2px;transform:translate(-50%,-50%)}
      #campsiteBridgeSelection .bridge-map-toolbar .bridge-mobile-add-point{
        min-width:92px!important;padding:0 12px!important;font-size:12px!important;background:#14532d!important;
        color:#dcfce7!important;border-color:rgba(34,197,94,.52)!important;white-space:nowrap;
      }
    `;
    document.head.appendChild(style);
  }

  function mobileGuideCopy() {
    const guide = document.getElementById('bridgeGuide');
    if (guide && !guide.textContent.includes('範囲を確認')) {
      const next = '<strong>公園・エリアを囲む</strong><br>画面中央の十字を外周に合わせ、「＋ 点を打つ」で頂点を追加してください。3点以上で緑の範囲になります。';
      if (guide.innerHTML !== next) guide.innerHTML = next;
    }

    const status = document.getElementById('bridgeSelectionStatus');
    if (status && /マウス|クリックして固定/.test(status.textContent || '')) {
      status.textContent = '中央の十字を次の位置に合わせ、「＋ 点を打つ」で次の頂点を追加してください。';
    }
  }

  function installCopyObserver() {
    const panel = document.getElementById('campsiteBridgeSelection');
    if (!panel || panel.dataset.mobileCopyObserver === '1') return;
    panel.dataset.mobileCopyObserver = '1';
    const observer = new MutationObserver(() => mobileGuideCopy());
    observer.observe(panel, { childList:true, subtree:true, characterData:true });
    mobileGuideCopy();
  }

  function addPointAtCenter(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (!bridgeMap) return;
    try {
      const center = bridgeMap.getCenter();
      bridgeMap.fire('click', { latlng:center, originalEvent:event || null });
    } catch (error) {
      console.warn('[Campsite Bridge] mobile point add failed', error);
    }
  }

  function configureMobileSelection() {
    if (configured) return true;
    const mapEl = document.getElementById('campsiteBridgeMap');
    const drawBtn = document.getElementById('bridgeDrawBtn');
    if (!mapEl || !drawBtn || !bridgeMap) return false;

    injectStyles();

    if (!mapEl.querySelector('.bridge-mobile-crosshair')) {
      const crosshair = document.createElement('div');
      crosshair.className = 'bridge-mobile-crosshair';
      crosshair.setAttribute('aria-hidden', 'true');
      mapEl.appendChild(crosshair);
    }

    if (drawBtn.getAttribute('aria-pressed') !== 'true') drawBtn.click();

    const pointBtn = drawBtn.cloneNode(true);
    pointBtn.id = 'bridgeDrawBtn';
    pointBtn.className = 'bridge-map-draw bridge-mobile-add-point';
    pointBtn.removeAttribute('aria-pressed');
    pointBtn.setAttribute('aria-label', '中央の十字位置に頂点を追加');
    pointBtn.textContent = '＋ 点を打つ';
    pointBtn.addEventListener('click', addPointAtCenter);
    drawBtn.replaceWith(pointBtn);

    const toolbar = pointBtn.closest('.bridge-map-toolbar');
    if (toolbar) toolbar.setAttribute('aria-label', 'ポリゴン操作。中央の十字に位置を合わせて点を追加します');

    installCopyObserver();
    configured = true;
    return true;
  }

  captureBridgeMapFactory();

  let attempts = 0;
  const timer = setInterval(() => {
    attempts++;
    if (configureMobileSelection() || attempts >= 100) clearInterval(timer);
  }, 100);
})();
