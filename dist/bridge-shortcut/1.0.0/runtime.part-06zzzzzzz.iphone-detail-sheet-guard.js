    ...(() => {
      // iPhone/Safari Wayfarer detail-sheet guard.
      // Hide every Bridge POI visual while a Wayfarer detail sheet is open,
      // regardless of which iPhone renderer produced the marker.
      const ua = String(navigator?.userAgent || '');
      if (!/iPhone|iPad|iPod/i.test(ua)) return {};

      const CLASS_NAME = 'cbs-wayfarer-detail-open';
      const STYLE_ID = 'campsite-bridge-iphone-detail-sheet-guard-style';
      let timer = null;
      let observer = null;
      let lastOpen = false;
      let lastReason = 'init';

      function ensureStyle() {
        let style = document.getElementById(STYLE_ID);
        if (style) return style;
        style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
          html.${CLASS_NAME} #campsite-bridge-iphone-forced-poi-colors,
          html.${CLASS_NAME} #campsite-bridge-iphone-latest-colors,
          html.${CLASS_NAME} #campsite-bridge-iphone-dom-overlay {
            display: none !important;
          }
          html.${CLASS_NAME} [data-cbs-forced-entity],
          html.${CLASS_NAME} [data-cbs-game-entity],
          html.${CLASS_NAME} [data-cbs-iphone-latest-entity],
          html.${CLASS_NAME} [data-cbs-sponsor-ring],
          html.${CLASS_NAME} [data-cbs-sponsor-popup] {
            visibility: hidden !important;
            pointer-events: none !important;
          }
        `;
        (document.head || document.documentElement).appendChild(style);
        return style;
      }

      function isVisible(element) {
        if (!element) return false;
        let rect = null;
        let style = null;
        try {
          rect = element.getBoundingClientRect();
          style = getComputedStyle(element);
        } catch (_) {
          return false;
        }
        if (!rect || !style) return false;
        if (rect.width < 2 || rect.height < 2) return false;
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
        return true;
      }

      function looksLikeDetailPanel(element) {
        if (!element || element === document.body || element === document.documentElement) return false;
        if (!isVisible(element)) return false;

        try {
          if (element.closest?.('#campsite-bridge-iphone-forced-poi-colors, #campsite-bridge-iphone-latest-colors, #campsite-bridge-iphone-dom-overlay, #campsite-bridge-shortcut-panel')) return false;
          if (element.matches?.('.gm-style, app-wf-base-map, google-map')) return false;
          if (element.querySelector?.('.gm-style')) return false;
        } catch (_) {}

        let rect = null;
        try { rect = element.getBoundingClientRect(); } catch (_) { return false; }
        if (!rect) return false;

        // The mobile Wayspot detail view is a large bottom sheet. Geometry is
        // intentionally used in addition to framework selectors because its
        // Angular/Material markup has changed between Wayfarer releases.
        if (rect.width < innerWidth * 0.80) return false;
        if (rect.height < innerHeight * 0.24) return false;
        if (rect.bottom < innerHeight * 0.88) return false;
        if (rect.top < innerHeight * 0.16 || rect.top > innerHeight * 0.82) return false;
        return true;
      }

      function explicitDetailPanel() {
        const selectors = [
          'mat-bottom-sheet-container',
          '.mat-bottom-sheet-container',
          '.mat-mdc-dialog-container',
          '.cdk-overlay-pane',
          '[role="dialog"]',
          '[aria-modal="true"]',
          '[class*="bottom-sheet"]',
          '[class*="bottomSheet"]',
          '[class*="detail-sheet"]',
          '[class*="detailSheet"]',
          '[class*="drawer"]'
        ];
        for (const selector of selectors) {
          let elements = [];
          try { elements = [...document.querySelectorAll(selector)]; } catch (_) { continue; }
          for (const element of elements) {
            if (looksLikeDetailPanel(element)) return { open: true, reason: `selector:${selector}` };
          }
        }
        return null;
      }

      function viewportDetailPanel() {
        const xs = [0.22, 0.5, 0.78];
        const ys = [0.54, 0.64, 0.74, 0.84, 0.92];
        for (const xr of xs) {
          for (const yr of ys) {
            const x = Math.max(1, Math.min(innerWidth - 2, innerWidth * xr));
            const y = Math.max(1, Math.min(innerHeight - 2, innerHeight * yr));
            let hit = null;
            try { hit = document.elementFromPoint(x, y); } catch (_) { hit = null; }
            let depth = 0;
            for (let element = hit; element && depth < 14; element = element.parentElement, depth += 1) {
              if (looksLikeDetailPanel(element)) return { open: true, reason: `viewport:${xr},${yr}` };
            }
          }
        }
        return null;
      }

      function detect() {
        return explicitDetailPanel() || viewportDetailPanel() || { open: false, reason: 'map' };
      }

      function apply() {
        const state = detect();
        lastOpen = Boolean(state.open);
        lastReason = String(state.reason || 'unknown');
        document.documentElement.classList.toggle(CLASS_NAME, lastOpen);
        return lastOpen;
      }

      function schedule(delay = 0) {
        setTimeout(apply, delay);
      }

      ensureStyle();
      apply();
      timer = setInterval(apply, 120);

      try {
        observer = new MutationObserver(() => schedule(0));
        observer.observe(document.body || document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['class', 'style', 'aria-modal', 'role']
        });
      } catch (_) {
        observer = null;
      }

      for (const eventName of ['click', 'touchend', 'pointerup', 'resize', 'scroll']) {
        window.addEventListener(eventName, () => {
          schedule(0);
          schedule(80);
          schedule(220);
        }, { passive: true, capture: true });
      }

      window.CampsiteBridgeIPhoneDetailGuard = Object.freeze({
        refresh: apply,
        getState: () => ({ open: lastOpen, reason: lastReason })
      });

      window.addEventListener('pagehide', () => {
        if (timer) clearInterval(timer);
        timer = null;
        try { observer?.disconnect?.(); } catch (_) {}
        observer = null;
        document.documentElement.classList.remove(CLASS_NAME);
        try { document.getElementById(STYLE_ID)?.remove?.(); } catch (_) {}
      }, { once: true });

      return {};
    })(),
