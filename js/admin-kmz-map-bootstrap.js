/* 提出KMZ MAP VIEWER: CDNフォールバック付き起動ローダー */
(function () {
  "use strict";

  const SESSION_TOKEN_KEY = "campsiteAdminSessionToken";
  const SESSION_EXPIRES_KEY = "campsiteAdminSessionExpiresAt";
  const LEGACY_UNLOCK_KEY = "campsiteAdminUnlocked";
  const SUPABASE_URL = "https://azkshxjgsbtjgwbapcfw.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_rWbeIqdWJJHHBtphER8bdg__CaS_xGK";

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

  function hasLiveAdminSession() {
    const token = sessionStorage.getItem(SESSION_TOKEN_KEY) || "";
    const expiresAt = sessionStorage.getItem(SESSION_EXPIRES_KEY) || "";
    if (!token || !expiresAt) return false;
    const expires = new Date(expiresAt).getTime();
    return Number.isFinite(expires) && expires > Date.now();
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

  function ensureAdminSession() {
    if (hasLiveAdminSession()) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const mapState = document.getElementById("kmvMapState");
      const list = document.getElementById("kmvListCount");
      if (!mapState) {
        reject(new Error("管理者ログイン画面を表示できませんでした。"));
        return;
      }

      if (list) list.textContent = "管理者認証が必要です";
      mapState.classList.remove("hidden", "error");
      mapState.innerHTML = `
        <div style="font-weight:900;font-size:15px;color:#f8fafc;margin-bottom:6px;">🔐 管理者ログイン</div>
        <div style="font-size:11px;color:#94a3b8;margin-bottom:12px;">MAP VIEWERを直接開いた場合は、ここで管理者コードを入力できます。</div>
        <input id="kmvAdminPassword" type="password" autocomplete="current-password" placeholder="管理者コード" style="width:100%;padding:11px 12px;border-radius:10px;border:1px solid rgba(148,163,184,.28);background:#0f172a;color:#f8fafc;font-size:16px;box-sizing:border-box;">
        <button id="kmvAdminLogin" type="button" style="width:100%;margin-top:9px;padding:11px 12px;border-radius:10px;border:1px solid rgba(56,189,248,.45);background:rgba(14,165,233,.16);color:#e0f2fe;font-weight:900;">管理者として開く</button>
        <div id="kmvAdminLoginError" style="min-height:18px;margin-top:8px;color:#fecaca;font-size:11px;"></div>
      `;

      const input = document.getElementById("kmvAdminPassword");
      const button = document.getElementById("kmvAdminLogin");
      const errorBox = document.getElementById("kmvAdminLoginError");

      const login = async () => {
        const password = String(input?.value || "").trim();
        if (!password) {
          if (errorBox) errorBox.textContent = "管理者コードを入力してください。";
          return;
        }

        if (button) button.disabled = true;
        if (errorBox) errorBox.textContent = "認証中…";

        try {
          if (!window.campsiteSupabase) {
            window.campsiteSupabase = window.supabase.createClient(
              SUPABASE_URL,
              SUPABASE_PUBLISHABLE_KEY
            );
          }

          const { data, error } = await window.campsiteSupabase.functions.invoke(
            "admin-auth",
            { body: { action: "login", password } }
          );

          if (error) {
            let message = error.message || "管理者認証に失敗しました。";
            try {
              const details = error.context && typeof error.context.json === "function"
                ? await error.context.json()
                : null;
              if (details?.error) message = details.error;
            } catch (_) {}
            throw new Error(message);
          }

          if (!data?.success || !data?.sessionToken || !data?.expiresAt) {
            throw new Error(data?.error || "管理者認証に失敗しました。" );
          }

          sessionStorage.setItem(SESSION_TOKEN_KEY, data.sessionToken);
          sessionStorage.setItem(SESSION_EXPIRES_KEY, data.expiresAt);
          sessionStorage.setItem(LEGACY_UNLOCK_KEY, "true");
          if (input) input.value = "";
          mapState.textContent = "認証しました。MAP VIEWERを起動しています…";
          if (list) list.textContent = "起動中…";
          resolve();
        } catch (error) {
          if (errorBox) errorBox.textContent = error?.message || "管理者認証に失敗しました。";
        } finally {
          if (button) button.disabled = false;
        }
      };

      button?.addEventListener("click", login);
      input?.addEventListener("keydown", event => {
        if (event.key === "Enter") login();
      });
      setTimeout(() => input?.focus(), 80);
    });
  }

  async function loadAppScript() {
    const old = document.getElementById("adminKmzMapAppScript");
    if (old) old.remove();

    const appUrl = `js/admin-kmz-map-v2.js?v=6&ts=${Date.now()}`;
    const response = await fetch(appUrl, { cache: "no-store" });
    if (!response.ok) throw new Error("MAP VIEWER本体を読み込めませんでした。");

    let source = await response.text();

    // 正式KMZの「新規 PokéStop / Gym / PowerSpot」も新規POIとして扱う。
    source = source.replace(
      'if (/追加|追加予定|追加希望|追加候補|候補|新設|planned|candidate|proposed|add/.test(text)) return "added";',
      'if (/追加|追加予定|追加希望|追加候補|候補|新設|新規|planned|candidate|proposed|add/.test(text)) return "added";'
    );

    // 審査時に一目で分かるよう、既存=青、新規=赤系で強く色分けする。
    source = source.replace(
      'addedPoi: "★ 追加予定POI",',
      'addedPoi: "★ 新規POI（赤）",'
    );
    source = source.replace(
      'radius: added ? 8 : 7,\n        weight: 2,\n        color: "#f8fafc",\n        fillColor: added ? "#fbbf24" : "#38bdf8",',
      'radius: added ? 9 : 7,\n        weight: added ? 3 : 2,\n        color: added ? "#9f1239" : "#f8fafc",\n        fillColor: added ? "#fb7185" : "#38bdf8",'
    );

    if (!source.includes('新規|planned') || !source.includes('#fb7185')) {
      throw new Error("新規POI色分けパッチを適用できませんでした。");
    }

    const script = document.createElement("script");
    script.id = "adminKmzMapAppScript";
    script.textContent = source;
    document.body.appendChild(script);
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

      await ensureAdminSession();

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
