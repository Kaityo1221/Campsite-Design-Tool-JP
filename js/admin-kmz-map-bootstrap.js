/* 提出KMZ MAP VIEWER: CDNフォールバック付き起動ローダー */
(function () {
  "use strict";

  function setStatus(message, isError) {
    const list = document.getElementById("kmvListCount");
    const mapState = document.getElementById("kmvMapState");
    if (list) list.textContent = message;
    if (mapState) {
      mapState.textContent = message;
      mapState.classList.remove("hidden", "error");
      if (isError) mapState.classList.add("error");
    }
  }

  function ensureStylesheet(href, id) {
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  function loadScriptSources(sources, readyCheck, idPrefix) {
    if (readyCheck()) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const tryLoad = (index) => {
        if (readyCheck()) {
          resolve();
          return;
        }
        if (index >= sources.length) {
          reject(new Error(`${idPrefix}を読み込めませんでした。`));
          return;
        }

        const script = document.createElement("script");
        script.id = `${idPrefix}-${index}`;
        script.src = sources[index];
        script.async = false;
        script.onload = () => {
          if (readyCheck()) resolve();
          else {
            script.remove();
            tryLoad(index + 1);
          }
        };
        script.onerror = () => {
          script.remove();
          tryLoad(index + 1);
        };
        document.head.appendChild(script);
      };

      tryLoad(0);
    });
  }

  function loadAppScript() {
    return new Promise((resolve, reject) => {
      const old = document.getElementById("adminKmzMapAppScript");
      if (old) old.remove();

      const script = document.createElement("script");
      script.id = "adminKmzMapAppScript";
      script.src = `js/admin-kmz-map-v2.js?v=4&ts=${Date.now()}`;
      script.async = false;
      script.onload = resolve;
      script.onerror = () => reject(new Error("MAP VIEWER本体を読み込めませんでした。"));
      document.body.appendChild(script);
    });
  }

  async function boot() {
    try {
      setStatus("地図ライブラリを準備中…", false);

      ensureStylesheet(
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css",
        "adminKmzLeafletCss"
      );

      await loadScriptSources(
        [
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js",
          "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js",
          "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        ],
        () => typeof window.L !== "undefined",
        "leaflet"
      );

      setStatus("KMZ解析ライブラリを準備中…", false);
      await loadScriptSources(
        [
          "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
          "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"
        ],
        () => typeof window.JSZip !== "undefined",
        "jszip"
      );

      setStatus("データ接続を準備中…", false);
      await loadScriptSources(
        [
          "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
          "https://unpkg.com/@supabase/supabase-js@2"
        ],
        () => Boolean(window.supabase?.createClient),
        "supabase"
      );

      setStatus("軽量一覧を読み込み中…", false);
      await loadAppScript();
    } catch (error) {
      console.error("MAP VIEWER bootstrap error", error);
      setStatus(error?.message || "MAP VIEWERを起動できませんでした。", true);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
