    ...(() => {
      // iPhone/Safari hardening layer.
      // 1) Try a deeper Angular walk so Bridge can recover the live Google Map
      //    immediately after launch, before the user has to zoom/pan.
      // 2) Keep both iPhone overlay paths below Wayfarer product UI and hide
      //    them while a POI detail sheet is open.
      const RECOVERY_ROOT_ID = 'campsite-bridge-iphone-latest-colors';
      const DOM_ROOT_ID = 'campsite-bridge-iphone-dom-overlay';
      let guardTimer = null;
      let observer = null;

      function deepFindGoogleMap() {
        const host = document.querySelector('app-wf-base-map');
        if (!host || !Array.isArray(host.__ngContext__)) return null;

        const queue = host.__ngContext__.map(value => ({ value, depth: 0 }));
        const seen = new WeakSet();
        let visited = 0;

        while (queue.length && visited < 2400) {
          const current = queue.shift();
          const value = current?.value;
          const depth = current?.depth ?? 0;
          if (!value || (typeof value !== 'object' && typeof value !== 'function')) continue;
          if (looksLikeGoogleMap(value)) return value;
          if (depth >= 5) continue;
          if (typeof value === 'object') {
            if (seen.has(value)) continue;
            seen.add(value);
          }
          visited += 1;

          let children = [];
          try {
            if (Array.isArray(value)) {
              children = value.slice(0, 80);
            } else {
              const keys = Object.keys(value).slice(0, 120);
              for (const key of keys) {
                let child = null;
                try { child = value[key]; } catch (_) { child = null; }
                if (child && (typeof child === 'object' || typeof child === 'function')) children.push(child);
              }
            }
          } catch (_) {
            children = [];
          }

          for (const child of children) queue.push({ value: child, depth: depth + 1 });
        }
        return null;
      }

      function retryMapRecovery() {
        if (bridgeMap) return true;
        let map = null;
        try { map = deepFindGoogleMap(); } catch (_) { map = null; }
        if (!map) return false;
        try { return Boolean(captureBridgeMap(map)); } catch (_) { return false; }
      }

      function looksLikeDetailSheetElement(element) {
        if (!element || element === document.body || element === document.documentElement) return false;
        if (element.closest?.('#campsite-bridge-shortcut-panel')) return false;
        if (element.id === RECOVERY_ROOT_ID || element.id === DOM_ROOT_ID) return false;
        if (element.closest?.(`#${RECOVERY_ROOT_ID}, #${DOM_ROOT_ID}`)) return false;

        let rect = null;
        let style = null;
        try {
          rect = element.getBoundingClientRect();
          style = getComputedStyle(element);
        } catch (_) {
          return false;
        }
        if (!rect || !style) return false;
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
        if (rect.width < innerWidth * 0.82 || rect.height < innerHeight * 0.22) return false;
        if (rect.bottom < innerHeight * 0.86 || rect.top > innerHeight * 0.8) return false;

        const classText = `${String(element.className || '')} ${String(element.id || '')}`;
        if (/bottom-sheet|bottomsheet|sheet|drawer|detail|poi-detail|place-detail/i.test(classText)) return true;

        let text = '';
        try { text = String(element.innerText || element.textContent || ''); } catch (_) { text = ''; }
        if (/ゲーム内/.test(text) && /(ポケストップ|ジム|パワースポット|位置|説明)/.test(text)) return true;

        return false;
      }

      function isDetailSheetOpen() {
        const selectors = [
          'mat-bottom-sheet-container',
          '.mat-bottom-sheet-container',
          '.mat-mdc-dialog-container',
          '[role="dialog"]',
          '[aria-modal="true"]',
          '.cdk-overlay-pane'
        ];
        for (const selector of selectors) {
          let elements = [];
          try { elements = [...document.querySelectorAll(selector)]; } catch (_) { elements = []; }
          for (const element of elements) {
            if (looksLikeDetailSheetElement(element)) return true;
          }
        }

        const x = Math.max(1, Math.min(innerWidth - 2, innerWidth * 0.5));
        for (const ratio of [0.68, 0.76, 0.84, 0.92]) {
          const y = Math.max(1, Math.min(innerHeight - 2, innerHeight * ratio));
          let hit = null;
          try { hit = document.elementFromPoint(x, y); } catch (_) { hit = null; }
          for (let element = hit; element && element !== document.body && element !== document.documentElement; element = element.parentElement) {
            if (looksLikeDetailSheetElement(element)) return true;
          }
        }
        return false;
      }

      function applyOverlayGuard() {
        const detailOpen = isDetailSheetOpen();
        for (const id of [RECOVERY_ROOT_ID, DOM_ROOT_ID]) {
          const root = document.getElementById(id);
          if (!root) continue;
          root.style.zIndex = '40';
          if (detailOpen) {
            root.dataset.cbsHiddenForWayfarerDetail = '1';
            root.style.display = 'none';
          } else if (root.dataset.cbsHiddenForWayfarerDetail === '1') {
            delete root.dataset.cbsHiddenForWayfarerDetail;
            root.style.display = '';
          }
        }
      }

      for (const delay of [120, 320, 700, 1400, 2600, 4200]) {
        setTimeout(() => {
          retryMapRecovery();
          applyOverlayGuard();
        }, delay);
      }

      guardTimer = setInterval(() => {
        retryMapRecovery();
        applyOverlayGuard();
      }, 500);

      try {
        observer = new MutationObserver(() => applyOverlayGuard());
        observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'aria-modal'] });
      } catch (_) {
        observer = null;
      }

      window.CampsiteBridgeIPhoneRuntimeGuard = Object.freeze({
        refresh: () => {
          const mapRecovered = retryMapRecovery();
          applyOverlayGuard();
          return { mapRecovered, detailSheetOpen: isDetailSheetOpen() };
        },
        getState: () => ({
          mapCaptured: Boolean(bridgeMap),
          detailSheetOpen: isDetailSheetOpen(),
          recoveryRoot: Boolean(document.getElementById(RECOVERY_ROOT_ID)),
          domRoot: Boolean(document.getElementById(DOM_ROOT_ID))
        })
      });

      window.addEventListener('pagehide', () => {
        if (guardTimer) clearInterval(guardTimer);
        guardTimer = null;
        try { observer?.disconnect?.(); } catch (_) {}
        observer = null;
      }, { once: true });

      return {};
    })(),
