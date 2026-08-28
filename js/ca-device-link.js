/* Approved CA session -> anonymous device identity link */
(function () {
  "use strict";

  const ACCESS_FUNCTION = "ca-access";
  const LINK_FUNCTION = "ca-device-link";
  const STORAGE_KEY = "campsiteUserId";
  let linking = false;
  let lastLinkedDeviceId = "";

  function getOrCreateDeviceId() {
    let deviceId = "";
    try {
      deviceId = localStorage.getItem(STORAGE_KEY) || "";
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem(STORAGE_KEY, deviceId);
      }
    } catch (_) {}
    return deviceId;
  }

  async function linkApprovedSession(force = false) {
    if (linking || !window.campsiteSupabase?.auth || !window.campsiteSupabase?.functions) return false;

    const deviceId = getOrCreateDeviceId();
    if (!deviceId) return false;
    if (!force && deviceId === lastLinkedDeviceId) return true;

    const { data: sessionData, error: sessionError } = await window.campsiteSupabase.auth.getSession();
    if (sessionError || !sessionData?.session) return false;

    linking = true;
    try {
      const { data: access, error: accessError } = await window.campsiteSupabase.functions.invoke(
        ACCESS_FUNCTION,
        { body: { action: "status" } }
      );
      if (accessError || !(access?.isApproved === true || access?.status === "approved")) return false;

      const { data, error } = await window.campsiteSupabase.functions.invoke(
        LINK_FUNCTION,
        { body: { anonymousDeviceId: deviceId } }
      );
      if (error || data?.success !== true) {
        console.warn("CA device link failed", error || data?.error || "unknown error");
        return false;
      }

      lastLinkedDeviceId = deviceId;
      window.dispatchEvent(new CustomEvent("campsite:device-identity-linked", {
        detail: { deviceId }
      }));
      return true;
    } catch (error) {
      console.warn("CA device link skipped", error);
      return false;
    } finally {
      linking = false;
    }
  }

  function start() {
    setTimeout(() => linkApprovedSession(false), 500);

    try {
      window.campsiteSupabase?.auth?.onAuthStateChange?.((event, session) => {
        if (session && event !== "SIGNED_OUT") {
          setTimeout(() => linkApprovedSession(true), 250);
        }
      });
    } catch (error) {
      console.warn("CA device link auth listener unavailable", error);
    }

    window.addEventListener("focus", () => {
      setTimeout(() => linkApprovedSession(false), 100);
    });
  }

  window.CampsiteCaDeviceLink = Object.freeze({
    link: () => linkApprovedSession(true),
    getDeviceId: getOrCreateDeviceId
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
