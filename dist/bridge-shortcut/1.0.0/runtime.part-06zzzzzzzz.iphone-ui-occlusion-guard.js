    ...(() => {
      // iPhone/Safari UI occlusion guard.
      // Bridge POI visuals intentionally sit above the Google map so Safari can
      // render them reliably. Keep that benefit while preventing the markers
      // from painting over Wayfarer's search/filter/map-control UI.
      const ua = String(navigator?.userAgent || '');
      if (!/iPhone|iPad|iPod/i.test(ua)) return {};

      const MARKER_SELECTOR = [
        '[data-cbs-forced-entity]',
        '[data-cbs-game-entity]',
        '[data-cbs-iphone-latest-entity]',
        '[data-cbs-sponsor-ring]'
      ].join(',');
      const CONTROL_SELECTOR = [
        'button',
        '[role="button"]',
        '[role="combobox"]',
        '[aria-haspopup="menu"]',
        '[aria-haspopup="listbox"]',
        '[aria-expanded]',
        'input',
        'select',
        'textarea',
        'mat-select'
      ].join(',');
      const BRIDGE_VISUAL_SELECTOR = [
        '#campsite-bridge-iphone-forced-poi-colors',
        '#campsite-bridge-iphone-latest-colors',
        '#campsite-bridge-iphone-dom-overlay'
      ].join(',');

      let timer = null;
      let observer = null;
      let scheduled = false;
      let lastHidden = 0;
      let lastControls = 0;

      function visibleRect(element) {
        if (!element) return null;
        let rect = null;
        let style = null;
        try {
          rect = element.getBoundingClientRect();
          style = getComputedStyle(element);
        } catch (_) {
          return null;
        }
        if (!rect || !style) return null;
        if (rect.width < 2 || rect.height < 2) return null;
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return null;
        if (rect.bottom <= 0 || rect.right <= 0 || rect.top >= innerHeight || rect.left >= innerWidth) return null;
        return rect;
      }

      function mapRect() {
        const candidates = [
          document.querySelector('.gm-style'),
          document.querySelector('app-wf-base-map'),
          document.querySelector('google-map')
        ].filter(Boolean);
        let best = null;
        for (const element of candidates) {
          const rect = visibleRect(element);
          if (!rect || rect.width < 120 || rect.height < 120) continue;
          if (!best || rect.width * rect.height > best.width * best.height) best = rect;
        }
        return best;
      }

      function intersects(a, b, pad = 0) {
        return !(
          a.right <= b.left - pad ||
          a.left >= b.right + pad ||
          a.bottom <= b.top - pad ||
          a.top >= b.bottom + pad
        );
      }

      function isBridgeVisual(element) {
        try { return Boolean(element.closest?.(BRIDGE_VISUAL_SELECTOR)); } catch (_) { return false; }
      }

      function isWayfarerControl(element, rect, map) {
        if (!element || !rect || !map) return false;
        if (isBridgeVisual(element)) return false;
        try {
          if (element.closest?.('#campsite-bridge-shortcut-panel')) return true;
        } catch (_) {}

        // Only controls that actually overlap the visible map can occlude a POI.
        if (!intersects(rect, map, 0)) return false;

        // Ignore tiny clickable map POIs. Wayfarer's actual UI controls are
        // materially larger than the native Wayspot dots.
        if (rect.width < 30 && rect.height < 30) return false;
        if (rect.width * rect.height < 700) return false;

        // Ignore giant layout containers that happen to carry an ARIA state.
        if (rect.width > innerWidth * 0.96 && rect.height > innerHeight * 0.55) return false;
        return true;
      }

      function controlRects(map) {
        const rects = [];
        let elements = [];
        try { elements = [...document.querySelectorAll(CONTROL_SELECTOR)]; } catch (_) { elements = []; }
        for (const element of elements) {
          const rect = visibleRect(element);
          if (!isWayfarerControl(element, rect, map)) continue;
          rects.push(rect);
        }
        return rects;
      }

      function apply() {
        scheduled = false;
        const map = mapRect();
        if (!map) return 0;
        const controls = controlRects(map);
        let hidden = 0;
        let markers = [];
        try { markers = [...document.querySelectorAll(MARKER_SELECTOR)]; } catch (_) { markers = []; }

        for (const marker of markers) {
          const rect = visibleRect(marker);
          if (!rect) continue;
          let blocked = false;
          for (const control of controls) {
            if (intersects(rect, control, 3)) {
              blocked = true;
              break;
            }
          }
          if (blocked) {
            marker.style.setProperty('visibility', 'hidden', 'important');
            marker.dataset.cbsUiOccluded = '1';
            hidden += 1;
          } else if (marker.dataset.cbsUiOccluded === '1') {
            marker.style.removeProperty('visibility');
            delete marker.dataset.cbsUiOccluded;
          }
        }

        lastHidden = hidden;
        lastControls = controls.length;
        return hidden;
      }

      function schedule(delay = 0) {
        if (delay > 0) {
          setTimeout(() => schedule(0), delay);
          return;
        }
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(apply);
      }

      // Forced POI colors redraw themselves periodically. Watch those child
      // replacements and immediately re-apply the occlusion rule.
      try {
        observer = new MutationObserver(() => schedule(0));
        observer.observe(document.body || document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['style', 'class', 'aria-expanded']
        });
      } catch (_) {
        observer = null;
      }

      for (const eventName of ['touchstart', 'touchmove', 'touchend', 'pointerup', 'resize', 'scroll']) {
        window.addEventListener(eventName, () => {
          schedule(0);
          schedule(80);
          schedule(220);
        }, { passive: true, capture: true });
      }

      timer = setInterval(apply, 260);
      for (const delay of [0, 120, 350, 800]) schedule(delay);

      window.CampsiteBridgeIPhoneUiOcclusionGuard = Object.freeze({
        refresh: apply,
        getState: () => ({ hidden: lastHidden, controls: lastControls })
      });

      window.addEventListener('pagehide', () => {
        if (timer) clearInterval(timer);
        timer = null;
        try { observer?.disconnect?.(); } catch (_) {}
        observer = null;
        try {
          for (const marker of document.querySelectorAll(`${MARKER_SELECTOR}[data-cbs-ui-occluded="1"]`)) {
            marker.style.removeProperty('visibility');
            delete marker.dataset.cbsUiOccluded;
          }
        } catch (_) {}
      }, { once: true });

      return {};
    })(),