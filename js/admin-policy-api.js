/* ======================================================
   Admin policy API wrapper
   - Reuses the existing admin session token.
   - Read / history / write all go through admin-policy-access.
====================================================== */
(function () {
  "use strict";

  if (window.CampsiteAdminPolicyApi) return;

  const FUNCTION_NAME = "admin-policy-access";

  async function invoke(action, payload = {}) {
    if (!window.campsiteSupabase?.functions) {
      throw new Error("Supabaseクライアントを初期化できませんでした。");
    }

    const sessionToken = window.CampsiteAdminAuth?.getSessionToken?.() || "";
    if (!sessionToken) {
      throw new Error("管理者認証が必要です。");
    }

    const { data, error } = await window.campsiteSupabase.functions.invoke(
      FUNCTION_NAME,
      {
        body: {
          action,
          sessionToken,
          ...payload
        }
      }
    );

    if (error) {
      let message = error.message || "ポリシー処理に失敗しました。";
      try {
        if (error.context && typeof error.context.json === "function") {
          const details = await error.context.json();
          if (details?.error) message = details.error;
          if (details?.authRequired === true) window.CampsiteAdminAuth?.clearSession?.();
        }
      } catch (_) {}
      throw new Error(message);
    }

    if (!data?.success) {
      if (data?.authRequired === true) window.CampsiteAdminAuth?.clearSession?.();
      throw new Error(data?.error || "ポリシー処理に失敗しました。");
    }

    return data;
  }

  async function getCurrent() {
    const data = await invoke("get");
    return data.policy || null;
  }

  async function getHistory(limit = 20) {
    const data = await invoke("history", { limit });
    return Array.isArray(data.items) ? data.items : [];
  }

  async function setCurrent(policy) {
    const data = await invoke("set", policy || {});
    await window.CampsitePolicy?.refresh?.().catch(() => {});
    return data.policy || null;
  }

  window.CampsiteAdminPolicyApi = Object.freeze({
    invoke,
    getCurrent,
    getHistory,
    setCurrent
  });
})();
