;(() => {
  // iPhone display policy:
  // - Campsite Bridge collects/classifies/sends POIs only.
  // - Visual game-entity coloring is delegated to WFMM.
  // - Wayfarer's own hollow orange/white Wayspot dots are suppressed to reduce map clutter.
  const ua = String(navigator?.userAgent || '');
  if (!/iPhone|iPad|iPod/i.test(ua)) return;

  const STYLE_ID = 'campsite-bridge-iphone-wfmm-color-policy';
  const HOLLOW_ATTR = 'data-campsite-hidden-wayfarer-hollow';
  const LEGACY_ROOT_IDS = [
    'campsite-bridge-iphone-latest-colors',
    'campsite-bridge-iphone-dom-overlay',
    'campsite-bridge-iphone-forced-poi-colors',
    'campsite-bridge-iphone-map-anchored-poi',
    'campsite-bridge-iphone-pane-locked-poi',
    'campsite-bridge-poi-colors'
  ];

  let hiddenHollowCount = 0;
  let scanTimer = 0;

  function ensurePolicyStyle() {
    let style = document.getElementById(STYLE_ID);
    if (style) return style;
    style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      [data-cbs-game-entity],
      #campsite-bridge-iphone-latest-colors,
      #campsite-bridge-iphone-dom-overlay,
      #campsite-bridge-iphone-forced-poi-colors,
      #campsite-bridge-iphone-map-anchored-poi,
      #campsite-bridge-iphone-pane-locked-poi,
      #campsite-bridge-poi-colors,
      [${HOLLOW_ATTR}="1"] {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
    return style;
  }

  function removeLegacyRoots() {
    for (const id of LEGACY_ROOT_IDS) {
      try { document.getElementById(id)?.remove?.(); } catch (_) {}
    }
  }

  function parseCssColor(value) {
    const text = String(value || '').trim().toLowerCase();
    if (!text || text === 'none' || text === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
    const m = text.match(/rgba?\(\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)(?:\s*[,\/]\s*(\d+(?:\.\d+)?))?\s*\)/i);
    if (!m) return null;
    return {
      r: Number(m[1]),
      g: Number(m[2]),
      b: Number(m[3]),
      a: m[4] == null ? 1 : Number(m[4])
    };
  }

  function isWayfarerOrange(value) {
    const c = parseCssColor(value);
    return !!c && c.a > 0.45 && c.r >= 205 && c.g >= 45 && c.g <= 150 && c.b <= 115;
  }

  function isWhiteOrClear(value) {
    const c = parseCssColor(value);
    return !!c && (c.a <= 0.08 || (c.r >= 232 && c.g >= 232 && c.b >= 232));
  }

  function isRound(style) {
    const radius = parseFloat(style.borderTopLeftRadius || style.borderRadius || '0');
    return Number.isFinite(radius) && radius >= 7;
  }

  function hasCssHollowOrangeDot(el, style) {
    const rect = el.getBoundingClientRect?.();
    if (!rect || rect.width < 10 || rect.height < 10 || rect.width > 40 || rect.height > 40) return false;
    if (Math.abs(rect.width - rect.height) > 5) return false;
    if (!isRound(style)) return false;

    const widths = [
      parseFloat(style.borderTopWidth || '0'),
      parseFloat(style.borderRightWidth || '0'),
      parseFloat(style.borderBottomWidth || '0'),
      parseFloat(style.borderLeftWidth || '0')
    ];
    const borderWidth = Math.max(...widths.filter(Number.isFinite), 0);
    const borderOrange = [style.borderTopColor, style.borderRightColor, style.borderBottomColor, style.borderLeftColor]
      .some(isWayfarerOrange);

    return borderWidth >= 2 && borderOrange && isWhiteOrClear(style.backgroundColor);
  }

  function hasSvgHollowOrangeDot(el) {
    const svg = el.matches?.('svg') ? el : el.querySelector?.('svg');
    if (!svg) return false;
    const rect = svg.getBoundingClientRect?.();
    if (!rect || rect.width < 10 || rect.height < 10 || rect.width > 40 || rect.height > 40) return false;

    const shapes = svg.querySelectorAll?.('circle, ellipse, path') || [];
    for (const shape of shapes) {
      const style = getComputedStyle(shape);
      const stroke = style.stroke || shape.getAttribute?.('stroke');
      const fill = style.fill || shape.getAttribute?.('fill');
      const strokeWidth = parseFloat(style.strokeWidth || shape.getAttribute?.('stroke-width') || '0');
      if (strokeWidth >= 2 && isWayfarerOrange(stroke) && isWhiteOrClear(fill)) return true;
    }
    return false;
  }

  function markerRootFor(el, mapRoot) {
    let node = el;
    let fallback = el;
    for (let depth = 0; node && node !== mapRoot && depth < 5; depth += 1, node = node.parentElement) {
      const rect = node.getBoundingClientRect?.();
      if (!rect) continue;
      if (rect.width >= 10 && rect.height >= 10 && rect.width <= 44 && rect.height <= 44) fallback = node;
      const style = getComputedStyle(node);
      if ((style.position === 'absolute' || style.position === 'fixed') && rect.width <= 44 && rect.height <= 44) return node;
    }
    return fallback;
  }

  function scanWayfarerHollowDots() {
    scanTimer = 0;
    const mapRoots = Array.from(document.querySelectorAll('.gm-style'));
    if (!mapRoots.length) return;

    for (const mapRoot of mapRoots) {
      const candidates = mapRoot.querySelectorAll('div, span, svg');
      const limit = Math.min(candidates.length, 1800);
      for (let i = 0; i < limit; i += 1) {
        const el = candidates[i];
        if (el.closest?.(`[${HOLLOW_ATTR}="1"]`)) continue;
        const rect = el.getBoundingClientRect?.();
        if (!rect || rect.width < 10 || rect.height < 10 || rect.width > 40 || rect.height > 40) continue;
        if (Math.abs(rect.width - rect.height) > 5) continue;

        let hollow = false;
        try {
          const style = getComputedStyle(el);
          hollow = hasCssHollowOrangeDot(el, style) || hasSvgHollowOrangeDot(el);
        } catch (_) {}
        if (!hollow) continue;

        const root = markerRootFor(el, mapRoot);
        if (!root || root === mapRoot) continue;
        root.setAttribute(HOLLOW_ATTR, '1');
        hiddenHollowCount += 1;
      }
    }
  }

  function scheduleHollowScan(delay = 80) {
    if (scanTimer) return;
    scanTimer = setTimeout(scanWayfarerHollowDots, delay);
  }

  function installWayfarerHollowObserver() {
    const observer = new MutationObserver(() => scheduleHollowScan(90));
    observer.observe(document.documentElement, { childList: true, subtree: true });
    scheduleHollowScan(0);
    setTimeout(() => scheduleHollowScan(0), 400);
    setTimeout(() => scheduleHollowScan(0), 1400);
    // Low-frequency fallback for Wayfarer map renderers that recycle existing marker nodes.
    setInterval(() => scheduleHollowScan(0), 1800);
  }

  ensurePolicyStyle();
  removeLegacyRoots();
  setTimeout(removeLegacyRoots, 250);
  setTimeout(removeLegacyRoots, 1200);
  installWayfarerHollowObserver();

  window.CampsiteBridgeIPhonePoiColorPolicy = Object.freeze({
    provider: 'WFMM',
    bridgeColors: false,
    hideWayfarerHollowDots: true,
    collection: true,
    classification: true,
    export: true,
    get hiddenWayfarerHollowDots() { return hiddenHollowCount; }
  });
})();
