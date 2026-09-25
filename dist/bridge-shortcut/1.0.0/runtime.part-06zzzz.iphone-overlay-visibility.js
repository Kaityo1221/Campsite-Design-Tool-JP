    ...(() => {
      // iPhone/Safari overlay visibility correction.
      // The runtime guard intentionally hides Bridge markers while a Wayfarer
      // detail sheet is open, but lowering the roots to z-index 40 can place
      // them underneath the Google map itself. Keep them above the map while
      // preserving the guard's display:none behavior for detail sheets.
      const STYLE_ID = 'campsite-bridge-iphone-overlay-visibility-style';
      const ensureStyle = () => {
        let style = document.getElementById(STYLE_ID);
        if (style) return style;
        style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
          #campsite-bridge-iphone-latest-colors,
          #campsite-bridge-iphone-dom-overlay {
            z-index: 2147483645 !important;
          }
        `;
        (document.head || document.documentElement).appendChild(style);
        return style;
      };

      ensureStyle();

      window.addEventListener('pagehide', () => {
        try { document.getElementById(STYLE_ID)?.remove?.(); } catch (_) {}
      }, { once: true });

      return {};
    })(),
