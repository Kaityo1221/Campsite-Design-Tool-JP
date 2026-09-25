    ...(() => {
      // Prefer the map-anchored iPhone renderer whenever it is healthy.
      // Older body-fixed/native experimental renderers remain available only as
      // fallback if the Google Maps OverlayView cannot be attached.
      const ua = String(navigator?.userAgent || '');
      if (!/iPhone|iPad|iPod/i.test(ua)) return {};

      const CLASS_NAME = 'cbs-iphone-map-anchored-active';
      const STYLE_ID = 'campsite-bridge-iphone-map-anchored-authority-style';
      let timer = null;

      function ensureStyle() {
        let style = document.getElementById(STYLE_ID);
        if (style) return style;
        style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
          html.${CLASS_NAME} #campsite-bridge-iphone-forced-poi-colors,
          html.${CLASS_NAME} #campsite-bridge-iphone-latest-colors,
          html.${CLASS_NAME} #campsite-bridge-iphone-dom-overlay,
          html.${CLASS_NAME} #campsite-bridge-poi-colors {
            display: none !important;
          }
        `;
        (document.head || document.documentElement).appendChild(style);
        return style;
      }

      function apply() {
        ensureStyle();
        let active = false;
        try { active = Boolean(window.CampsiteBridgeIPhoneMapAnchoredPoi?.isActive?.()); } catch (_) {}
        document.documentElement.classList.toggle(CLASS_NAME, active);
        return active;
      }

      ensureStyle();
      apply();
      timer = setInterval(apply, 120);
      for (const delay of [0, 80, 200, 500, 1000]) setTimeout(apply, delay);

      window.CampsiteBridgeIPhoneMapAnchoredAuthority = Object.freeze({
        refresh: apply,
        isActive: () => document.documentElement.classList.contains(CLASS_NAME)
      });

      window.addEventListener('pagehide', () => {
        if (timer) clearInterval(timer);
        timer = null;
        document.documentElement.classList.remove(CLASS_NAME);
        try { document.getElementById(STYLE_ID)?.remove?.(); } catch (_) {}
      }, { once: true });

      return {};
    })(),
