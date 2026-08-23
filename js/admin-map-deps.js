/* 管理者画面: 過去状態比較用の地図依存関係 */
(function () {
  "use strict";

  const LEAFLET_CSS_ID = "campsiteLeafletCss";
  const LEAFLET_SCRIPT_ID = "campsiteLeafletScript";
  const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

  function ensureCss() {
    if (document.getElementById(LEAFLET_CSS_ID)) return;
    const link = document.createElement("link");
    link.id = LEAFLET_CSS_ID;
    link.rel = "stylesheet";
    link.href = LEAFLET_CSS;
    link.crossOrigin = "";
    document.head.appendChild(link);
  }

  function ensureScript() {
    if (window.L) return Promise.resolve();
    const existing = document.getElementById(LEAFLET_SCRIPT_ID);
    if (existing) {
      return new Promise((resolve, reject) => {
        if (window.L) return resolve();
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Leafletを読み込めませんでした。")), { once: true });
      });
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.id = LEAFLET_SCRIPT_ID;
      script.src = LEAFLET_JS;
      script.crossOrigin = "";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Leafletを読み込めませんでした。"));
      document.head.appendChild(script);
    });
  }

  async function ready() {
    ensureCss();
    await ensureScript();
    if (!window.L) throw new Error("地図ライブラリを初期化できませんでした。");
    return window.L;
  }

  window.CampsiteAdminMapDeps = Object.freeze({ ready });
})();
