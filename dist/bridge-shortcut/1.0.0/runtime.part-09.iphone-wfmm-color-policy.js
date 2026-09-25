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
    if (text === 'white') return { r: 255, g: 255, b: 255, a: 1 };
    if (text === 'black') return { r: 0, g: 0, b: 0, a: 1 };

    const hex = text.match(/^#([0-9a-f]{3,8})$/i);
    if (hex) {
      let body = hex[1];
      if (body.length === 3 || body.length === 4) body = body.split('').map(ch => ch + ch).join('');
      if (body.length === 6 || body.length === 8) {
        return {
          r: parseInt(body.slice(0, 2), 16),
          g: parseInt(body.slice(2, 4), 16),
          b: parseInt(body.slice(4, 6), 16),
          a: body.length === 8 ? parseInt(body.slice(6, 8), 16) / 255 : 1
        };
      }
    }

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
    if (!rect || rect.width < 10 || rect.height < 10 || rect.width > 42 || rect.height > 42) return false;
    if (Math.abs(rect.width - rect.height) > 6) return false;
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

    return borderWidth >= 1.5 && borderOrange && isWhiteOrClear(style.backgroundColor);
  }

  function hasPseudoHollowOrangeDot(el, pseudo) {
    let style = null;
    try { style = getComputedStyle(el, pseudo); } catch (_) { style = null; }
    if (!style || style.content === 'none') return false;
    const width = parseFloat(style.width || '0');
    const height = parseFloat(style.height || '0');
    if (width < 10 || height < 10 || width > 42 || height > 42 || Math.abs(width - height) > 6) return false;
    return hasCssHollowOrangeDot({ getBoundingClientRect: () => ({ width, height }) }, style);
  }

  function hasSvgHollowOrangeDot(el) {
    const svg = el.matches?.('svg') ? el : el.querySelector?.('svg');
    if (!svg) return false;
    const rect = svg.getBoundingClientRect?.();
    if (!rect || rect.width < 10 || rect.height < 10 || rect.width > 42 || rect.height > 42) return false;

    const shapes = svg.querySelectorAll?.('circle, ellipse, path') || [];
    for (const shape of shapes) {
      const style = getComputedStyle(shape);
      const stroke = style.stroke || shape.getAttribute?.('stroke');
      const fill = style.fill || shape.getAttribute?.('fill');
      const strokeWidth = parseFloat(style.strokeWidth || shape.getAttribute?.('stroke-width') || '0');
      if (strokeWidth >= 1.5 && isWayfarerOrange(stroke) && isWhiteOrClear(fill)) return true;
    }
    return false;
  }

  function decodeSvgDataUrl(value) {
    const src = String(value || '').trim();
    if (!src.startsWith('data:image/svg+xml')) return '';
    const comma = src.indexOf(',');
    if (comma < 0) return '';
    const meta = src.slice(0, comma).toLowerCase();
    const body = src.slice(comma + 1);
    try {
      return meta.includes(';base64') ? atob(body) : decodeURIComponent(body);
    } catch (_) {
      return '';
    }
  }

  function svgTextHasHollowOrangeDot(text) {
    const source = String(text || '');
    if (!source) return false;
    const strokeMatches = Array.from(source.matchAll(/stroke\s*=\s*["']([^"']+)["']/ig), m => m[1]);
    const fillMatches = Array.from(source.matchAll(/fill\s*=\s*["']([^"']+)["']/ig), m => m[1]);
    const hasOrangeStroke = strokeMatches.some(isWayfarerOrange);
    const hasWhiteFill = fillMatches.some(isWhiteOrClear);
    const widthMatches = Array.from(source.matchAll(/stroke-width\s*=\s*["']([^"']+)["']/ig), m => parseFloat(m[1]));
    const thickEnough = !widthMatches.length || widthMatches.some(v => Number.isFinite(v) && v >= 1.5);
    return hasOrangeStroke && hasWhiteFill && thickEnough;
  }

  function hasImageHollowOrangeDot(el, style) {
    let src = '';
    if (el.matches?.('img')) src = el.currentSrc || el.src || '';
    if (!src && el.matches?.('image')) src = el.getAttribute?.('href') || el.getAttribute?.('xlink:href') || '';
    if (src && svgTextHasHollowOrangeDot(decodeSvgDataUrl(src))) return true;

    const bg = String(style?.backgroundImage || '');
    if (bg.includes('data:image/svg+xml')) {
      const m = bg.match(/url\(["']?([^"')]+)["']?\)/i);
      if (m && svgTextHasHollowOrangeDot(decodeSvgDataUrl(m[1]))) return true;
    }
    return false;
  }

  function pixelLooksOrange(pixel) {
    if (!pixel || pixel.length < 4) return false;
    return pixel[3] > 115 && pixel[0] >= 205 && pixel[1] >= 45 && pixel[1] <= 150 && pixel[2] <= 115;
  }

  function pixelLooksWhiteOrClear(pixel) {
    if (!pixel || pixel.length < 4) return false;
    return pixel[3] <= 25 || (pixel[0] >= 232 && pixel[1] >= 232 && pixel[2] >= 232);
  }

  function hasCanvasHollowOrangeDot(el) {
    if (!el.matches?.('canvas')) return false;
    const rect = el.getBoundingClientRect?.();
    if (!rect || rect.width < 10 || rect.height < 10 || rect.width > 42 || rect.height > 42) return false;
    try {
      const ctx = el.getContext('2d', { willReadFrequently: true });
      if (!ctx || !el.width || !el.height) return false;
      const cx = Math.max(0, Math.min(el.width - 1, Math.round(el.width / 2)));
      const cy = Math.max(0, Math.min(el.height - 1, Math.round(el.height / 2)));
      const center = ctx.getImageData(cx, cy, 1, 1).data;
      if (!pixelLooksWhiteOrClear(center)) return false;
      const radius = Math.max(2, Math.round(Math.min(el.width, el.height) * 0.36));
      const samples = [
        [cx + radius, cy], [cx - radius, cy], [cx, cy + radius], [cx, cy - radius],
        [cx + Math.round(radius * 0.7), cy + Math.round(radius * 0.7)],
        [cx - Math.round(radius * 0.7), cy - Math.round(radius * 0.7)]
      ];
      let orange = 0;
      for (const [x0, y0] of samples) {
        const x = Math.max(0, Math.min(el.width - 1, x0));
        const y = Math.max(0, Math.min(el.height - 1, y0));
        if (pixelLooksOrange(ctx.getImageData(x, y, 1, 1).data)) orange += 1;
      }
      return orange >= 2;
    } catch (_) {
      return false;
    }
  }

  function markerRootFor(el, mapRoot) {
    let node = el;
    let fallback = el;
    for (let depth = 0; node && node !== mapRoot && depth < 6; depth += 1, node = node.parentElement) {
      const rect = node.getBoundingClientRect?.();
      if (!rect) continue;
      if (rect.width >= 10 && rect.height >= 10 && rect.width <= 48 && rect.height <= 48) fallback = node;
      const style = getComputedStyle(node);
      if ((style.position === 'absolute' || style.position === 'fixed') && rect.width <= 48 && rect.height <= 48) return node;
    }
    return fallback;
  }

  function scanWayfarerHollowDots() {
    scanTimer = 0;
    const mapRoots = Array.from(document.querySelectorAll('.gm-style'));
    if (!mapRoots.length) return;

    for (const mapRoot of mapRoots) {
      const candidates = mapRoot.querySelectorAll('div, span, svg, img, image, canvas');
      const limit = Math.min(candidates.length, 2600);
      for (let i = 0; i < limit; i += 1) {
        const el = candidates[i];
        if (el.closest?.(`[${HOLLOW_ATTR}="1"]`)) continue;
        const rect = el.getBoundingClientRect?.();
        if (!rect || rect.width < 10 || rect.height < 10 || rect.width > 42 || rect.height > 42) continue;
        if (Math.abs(rect.width - rect.height) > 6) continue;

        let hollow = false;
        try {
          const style = getComputedStyle(el);
          hollow = hasCssHollowOrangeDot(el, style)
            || hasPseudoHollowOrangeDot(el, '::before')
            || hasPseudoHollowOrangeDot(el, '::after')
            || hasSvgHollowOrangeDot(el)
            || hasImageHollowOrangeDot(el, style)
            || hasCanvasHollowOrangeDot(el);
        } catch (_) {}
        if (!hollow) continue;

        const root = markerRootFor(el, mapRoot);
        if (!root || root === mapRoot) continue;
        root.setAttribute(HOLLOW_ATTR, '1');
        hiddenHollowCount += 1;
      }
    }
  }

  function scheduleHollowScan(delay = 120) {
    if (scanTimer) return;
    scanTimer = setTimeout(scanWayfarerHollowDots, delay);
  }

  function installWayfarerHollowObserver() {
    const observer = new MutationObserver(() => scheduleHollowScan(140));
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'style'] });
    scheduleHollowScan(0);
    setTimeout(() => scheduleHollowScan(0), 350);
    setTimeout(() => scheduleHollowScan(0), 1200);
    setInterval(() => scheduleHollowScan(0), 2200);
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
