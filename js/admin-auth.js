/* ======================================================
   管理者認証クライアント

   - 管理者パスワードはフロントに保持しない
   - Supabase Edge Function admin-auth で照合
   - 成功後は sessionStorage に管理者セッションだけ保存
   - タブ/ブラウザを閉じると再ログイン
====================================================== */

(function () {
  "use strict";

  const FUNCTION_NAME = "admin-auth";
  const SESSION_TOKEN_KEY = "campsiteAdminSessionToken";
  const SESSION_EXPIRES_KEY = "campsiteAdminSessionExpiresAt";
  const LEGACY_UNLOCK_KEY = "campsiteAdminUnlocked";

  function getSessionToken() {
    return sessionStorage.getItem(SESSION_TOKEN_KEY) || "";
  }

  function getSessionExpiresAt() {
    return sessionStorage.getItem(SESSION_EXPIRES_KEY) || "";
  }

  function isLocalSessionAlive() {
    const token = getSessionToken();
    const expiresAt = getSessionExpiresAt();

    if (!token || !expiresAt) return false;

    const expires = new Date(expiresAt).getTime();
    return Number.isFinite(expires) && expires > Date.now();
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    sessionStorage.removeItem(SESSION_EXPIRES_KEY);
    sessionStorage.removeItem(LEGACY_UNLOCK_KEY);

    if (typeof window.hideAliasReviewAdminBox === "function") {
      window.hideAliasReviewAdminBox();
    }
  }

  function isUnlocked() {
    return isLocalSessionAlive();
  }

  async function invokeAuth(body) {
    if (!window.campsiteSupabase?.functions) {
      throw new Error("Supabaseクライアントを初期化できませんでした。");
    }

    const { data, error } = await window.campsiteSupabase.functions.invoke(
      FUNCTION_NAME,
      { body }
    );

    if (error) {
      let message = error.message || "管理者認証に失敗しました。";
      let details = null;

      try {
        if (error.context && typeof error.context.json === "function") {
          details = await error.context.json();
          if (details?.error) message = details.error;
        }
      } catch (_) {}

      const authError = new Error(message);
      authError.rateLimited = details?.rateLimited === true;
      authError.remainingAttempts = details?.remainingAttempts;
      throw authError;
    }

    if (!data?.success) {
      const authError = new Error(data?.error || "管理者認証に失敗しました。");
      authError.rateLimited = data?.rateLimited === true;
      authError.remainingAttempts = data?.remainingAttempts;
      throw authError;
    }

    return data;
  }

  function showAdminModal() {
    const modal = document.getElementById("adminLoginModal");
    const input = document.getElementById("adminCodeInput");
    const error = document.getElementById("adminLoginError");

    if (!modal) {
      alert("管理者ログイン画面が見つかりません");
      return;
    }

    if (error) error.textContent = "";
    if (input) input.value = "";

    modal.style.display = "flex";

    setTimeout(() => {
      input?.focus();
    }, 100);
  }

  function closeAdminModal() {
    const modal = document.getElementById("adminLoginModal");
    if (modal) modal.style.display = "none";
  }

  function openAdminUi() {
    closeAdminModal();

    sessionStorage.setItem(LEGACY_UNLOCK_KEY, "true");
    localStorage.removeItem(LEGACY_UNLOCK_KEY);

    if (typeof window.openTab === "function") {
      window.openTab("admin", null);
    }

    if (typeof window.showAliasReviewAdminBox === "function") {
      window.showAliasReviewAdminBox();
    }

    document.querySelectorAll(".tab-button").forEach(btn => {
      btn.classList.remove("active");
    });

    window.scrollTo({ top: 0, behavior: "smooth" });

    window.AdminKmzBrowser?.onAuthenticated?.();
  }

  async function validateSession() {
    if (!isLocalSessionAlive()) {
      clearSession();
      return false;
    }

    try {
      const data = await invokeAuth({
        action: "validate",
        sessionToken: getSessionToken()
      });

      if (data?.expiresAt) {
        sessionStorage.setItem(SESSION_EXPIRES_KEY, data.expiresAt);
      }

      sessionStorage.setItem(LEGACY_UNLOCK_KEY, "true");
      return true;
    } catch (_) {
      clearSession();
      return false;
    }
  }

  async function openAdminEntry() {
    if (isLocalSessionAlive()) {
      const valid = await validateSession();
      if (valid) {
        openAdminUi();
        return;
      }
    }

    showAdminModal();
  }

  async function loginFromModal() {
    const input = document.getElementById("adminCodeInput");
    const error = document.getElementById("adminLoginError");
    const button = document.querySelector(".admin-login-open-btn");

    if (!input) return;

    const password = String(input.value || "").trim();
    if (!password) {
      if (error) error.textContent = "管理者パスワードを入力してください";
      return;
    }

    if (button) button.disabled = true;
    if (error) error.textContent = "認証中…";

    try {
      const data = await invokeAuth({ action: "login", password });

      input.value = "";

      sessionStorage.setItem(SESSION_TOKEN_KEY, data.sessionToken);
      sessionStorage.setItem(SESSION_EXPIRES_KEY, data.expiresAt);
      sessionStorage.setItem(LEGACY_UNLOCK_KEY, "true");

      if (error) error.textContent = "";
      openAdminUi();
    } catch (authError) {
      clearSession();

      let message = authError?.message || "管理者認証に失敗しました";
      if (
        Number.isFinite(Number(authError?.remainingAttempts)) &&
        Number(authError.remainingAttempts) > 0
      ) {
        message += `（残り${Number(authError.remainingAttempts)}回）`;
      }

      if (error) error.textContent = message;
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function logout() {
    const token = getSessionToken();

    if (token) {
      try {
        await invokeAuth({ action: "logout", sessionToken: token });
      } catch (_) {}
    }

    clearSession();
  }

  async function restoreSession() {
    if (!isLocalSessionAlive()) {
      clearSession();
      return;
    }

    await validateSession();
  }

  window.CampsiteAdminAuth = Object.freeze({
    getSessionToken,
    isUnlocked,
    validateSession,
    clearSession,
    loginFromModal,
    openAdminEntry,
    logout
  });

  // 既存HTMLの onclick / Enter キー処理はこの2つを呼ぶため、
  // 関数名を維持したままサーバー認証へ差し替える。
  window.openAdminLogin = openAdminEntry;
  window.checkAdminCode = loginFromModal;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", restoreSession);
  } else {
    restoreSession();
  }
})();
