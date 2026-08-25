/* ======================================================
   Japan CA Access Gate

   - Discord OAuth で本人確認
   - Discord User ID はサーバー側 ca-access で検証
   - 初回は pending 登録し、会長承認後のみ利用可能
   - 旧共有アクセスコードは使用しない
====================================================== */

(function () {
  "use strict";

  const FUNCTION_NAME = "ca-access";
  const GATE_ID = "caAccessGate";

  function addStyles() {
    if (document.getElementById("caAccessGateStyles")) return;
    const style = document.createElement("style");
    style.id = "caAccessGateStyles";
    style.textContent = `
      #${GATE_ID}{position:fixed;inset:0;z-index:2147483000;background:radial-gradient(circle at 50% 18%,#162238 0,#08111f 46%,#020617 100%);display:flex;align-items:center;justify-content:center;padding:22px;color:#fff;font-family:inherit}
      #${GATE_ID} .ca-gate-card{width:min(420px,100%);background:rgba(15,23,42,.94);border:1px solid rgba(148,163,184,.28);border-radius:22px;padding:28px 24px;box-shadow:0 24px 80px rgba(0,0,0,.45);text-align:center}
      #${GATE_ID} .ca-gate-lock{font-size:34px;margin-bottom:8px}
      #${GATE_ID} h2{margin:0 0 8px;font-size:24px}
      #${GATE_ID} .ca-gate-badge{display:inline-block;margin:0 0 16px;padding:5px 10px;border:1px solid rgba(96,165,250,.4);border-radius:999px;background:rgba(59,130,246,.12);color:#bfdbfe;font-size:12px;font-weight:800;letter-spacing:.04em}
      #${GATE_ID} .ca-gate-copy{margin:0 0 18px;color:#cbd5e1;font-size:14px;line-height:1.7}
      #${GATE_ID} .ca-discord-btn{width:100%;border:0;border-radius:13px;padding:14px 16px;background:#5865f2;color:#fff;font-size:16px;font-weight:900;cursor:pointer;box-shadow:0 10px 28px rgba(88,101,242,.22)}
      #${GATE_ID} .ca-discord-btn:disabled{opacity:.55;cursor:wait}
      #${GATE_ID} .ca-secondary-btn{margin-top:10px;width:100%;border:1px solid #475569;border-radius:12px;padding:11px 14px;background:#111827;color:#e2e8f0;font-size:14px;font-weight:800;cursor:pointer}
      #${GATE_ID} .ca-gate-status{min-height:22px;margin-top:14px;color:#cbd5e1;font-size:13px;line-height:1.6}
      #${GATE_ID} .ca-gate-status.pending{color:#fde68a}
      #${GATE_ID} .ca-gate-status.error{color:#fecaca}
      #${GATE_ID} .ca-gate-status.ok{color:#bbf7d0}
      #${GATE_ID} .ca-gate-note{margin:18px 0 0;color:#94a3b8;font-size:11px;line-height:1.6}
    `;
    document.head.appendChild(style);
  }

  function ensureGate() {
    addStyles();
    let gate = document.getElementById(GATE_ID);
    if (gate) return gate;

    gate = document.createElement("div");
    gate.id = GATE_ID;
    gate.innerHTML = `
      <div class="ca-gate-card" role="dialog" aria-modal="true" aria-label="日本CAアクセス認証">
        <div class="ca-gate-lock">🔐</div>
        <h2>Campsite Design Tool</h2>
        <div class="ca-gate-badge">JAPAN COMMUNITY AMBASSADOR ONLY</div>
        <p class="ca-gate-copy">このツールは現在、日本国内のCommunity Ambassador限定で運用しています。<br>Discordで本人確認してください。</p>
        <button type="button" id="caDiscordLoginButton" class="ca-discord-btn">Discordでログイン</button>
        <button type="button" id="caEnterButton" class="ca-discord-btn" style="display:none;">Campsite Design Toolを開く</button>
        <button type="button" id="caStatusButton" class="ca-secondary-btn" style="display:none;">承認状況を確認</button>
        <button type="button" id="caLogoutButton" class="ca-secondary-btn" style="display:none;">Discordからログアウト</button>
        <div id="caGateStatus" class="ca-gate-status"></div>
        <p class="ca-gate-note">初回ログイン時は会長の承認が必要です。<br>第三者・海外CAへのアカウント共有はできません。</p>
      </div>`;

    document.body.appendChild(gate);
    gate.querySelector("#caDiscordLoginButton")?.addEventListener("click", signInWithDiscord);
    gate.querySelector("#caEnterButton")?.addEventListener("click", unlockMainPage);
    gate.querySelector("#caStatusButton")?.addEventListener("click", checkAccess);
    gate.querySelector("#caLogoutButton")?.addEventListener("click", signOut);
    return gate;
  }

  function setStatus(message, type = "") {
    const el = document.getElementById("caGateStatus");
    if (!el) return;
    el.className = `ca-gate-status ${type}`.trim();
    el.textContent = message || "";
  }

  function setButtons({ login = true, enter = false, status = false, logout = false, busy = false } = {}) {
    const loginBtn = document.getElementById("caDiscordLoginButton");
    const enterBtn = document.getElementById("caEnterButton");
    const statusBtn = document.getElementById("caStatusButton");
    const logoutBtn = document.getElementById("caLogoutButton");
    if (loginBtn) {
      loginBtn.style.display = login ? "block" : "none";
      loginBtn.disabled = !!busy;
    }
    if (enterBtn) {
      enterBtn.style.display = enter ? "block" : "none";
      enterBtn.disabled = !!busy;
    }
    if (statusBtn) {
      statusBtn.style.display = status ? "block" : "none";
      statusBtn.disabled = !!busy;
    }
    if (logoutBtn) {
      logoutBtn.style.display = logout ? "block" : "none";
      logoutBtn.disabled = !!busy;
    }
  }

  async function signInWithDiscord() {
    if (!window.campsiteSupabase?.auth) {
      setStatus("認証システムを読み込めませんでした。再読み込みしてください。", "error");
      return;
    }

    setButtons({ login: true, busy: true });
    setStatus("Discordを開いています…");

    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await window.campsiteSupabase.auth.signInWithOAuth({
      provider: "discord",
      options: { redirectTo }
    });

    if (error) {
      console.error("Discord OAuth error", error);
      setButtons({ login: true });
      setStatus("Discordログインを開始できませんでした。", "error");
    }
  }

  async function invokeAccess() {
    const { data, error } = await window.campsiteSupabase.functions.invoke(FUNCTION_NAME, {
      body: { action: "status" }
    });

    if (error) {
      console.error("CA access error", error);
      throw error;
    }
    return data;
  }

  function unlockMainPage() {
    const loginSound = document.getElementById("loginSound");
    if (loginSound) {
      try {
        loginSound.currentTime = 0;
        loginSound.volume = 0.08;
        loginSound.play().catch(() => {});
      } catch (_) {}
    }

    document.getElementById(GATE_ID)?.remove();

    const legacyLogin = document.getElementById("loginScreen");
    if (legacyLogin) legacyLogin.remove();

    const splash = document.getElementById("splashScreen");
    if (!splash) return;

    document.body.classList.add("opening-mode");
    splash.classList.add("show");

    setTimeout(() => {
      splash.remove();
      if (typeof window.showOpeningScreen === "function") {
        window.showOpeningScreen();
      }
    }, 1600);
  }

  async function checkAccess() {
    ensureGate();

    if (!window.campsiteSupabase?.auth) {
      setStatus("認証システムを読み込めませんでした。", "error");
      return;
    }

    setButtons({ login: false, enter: false, status: false, logout: true, busy: true });
    setStatus("日本CAアクセスを確認しています…");

    const { data: sessionData, error: sessionError } = await window.campsiteSupabase.auth.getSession();
    const session = sessionData?.session;

    if (sessionError || !session) {
      setButtons({ login: true });
      setStatus("");
      return;
    }

    try {
      const result = await invokeAccess();

      if (result?.isApproved === true || result?.status === "approved") {
        setButtons({ login: false, enter: true, status: false, logout: true });
        setStatus("承認済みです。ボタンを押して開始してください。", "ok");
        return;
      }

      if (result?.status === "pending") {
        setButtons({ login: false, enter: false, status: true, logout: true });
        setStatus(`承認申請を送信しました。会長の承認待ちです。${result.discordGlobalName || result.discordName ? ` (${result.discordGlobalName || result.discordName})` : ""}`, "pending");
        return;
      }

      if (result?.status === "rejected") {
        setButtons({ login: false, enter: false, status: true, logout: true });
        setStatus("このアカウントの申請は現在承認されていません。", "error");
        return;
      }

      if (result?.status === "revoked") {
        setButtons({ login: false, enter: false, status: true, logout: true });
        setStatus("このアカウントの利用許可は停止されています。", "error");
        return;
      }

      setButtons({ login: false, enter: false, status: true, logout: true });
      setStatus("承認状態を確認できませんでした。", "error");
    } catch (_) {
      setButtons({ login: false, enter: false, status: true, logout: true });
      setStatus("承認状態の確認に失敗しました。時間をおいて再度お試しください。", "error");
    }
  }

  async function signOut() {
    if (window.campsiteSupabase?.auth) {
      try { await window.campsiteSupabase.auth.signOut(); } catch (_) {}
    }
    setButtons({ login: true, enter: false });
    setStatus("ログアウトしました。");
  }

  function disableLegacyPasscode() {
    window.checkAccessCode = function () {
      ensureGate();
      setStatus("現在はDiscord認証を使用しています。", "pending");
    };
  }

  async function boot() {
    ensureGate();
    disableLegacyPasscode();
    await checkAccess();
  }

  window.CampsiteCaAccess = Object.freeze({
    checkAccess,
    signInWithDiscord,
    signOut
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
