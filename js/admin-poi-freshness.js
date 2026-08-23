/* 管理者レビュー補助: 長期間確認されていないPOIを静かに知らせる */
(function () {
  "use strict";

  const FUNCTION_NAME = "admin-poi-freshness";
  const BOX_ID = "adminPoiFreshnessNotice";

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getSessionToken() {
    return window.CampsiteAdminAuth?.getSessionToken?.() || "";
  }

  async function invoke(points) {
    if (!window.campsiteSupabase?.functions) return [];
    const sessionToken = getSessionToken();
    if (!sessionToken) return [];

    const { data, error } = await window.campsiteSupabase.functions.invoke(FUNCTION_NAME, {
      body: { sessionToken, points }
    });
    if (error || !data?.success) return [];
    return Array.isArray(data.items) ? data.items : [];
  }

  function isExistingLayer(layerName) {
    const name = String(layerName || "");
    const lower = name.toLowerCase();
    const isCircle = name.includes("円") || name.includes("30m") || name.includes("40m") || name.includes("50m");
    const isAdd = name.includes("追加希望") || name.includes("追加") || name.includes("新規") || lower.includes("add");
    const isPoi = name.includes("既存") || name.includes("ポケスト") || name.includes("ジム") || name.includes("パワ") || lower.includes("pokestop") || lower.includes("gym") || lower.includes("power");
    return !isCircle && !isAdd && isPoi;
  }

  async function collectExistingPoints() {
    const input = document.getElementById("adminReviewFile");
    if (!input?.files?.length || typeof window.extractLayersFromKML !== "function") return [];

    try {
      const extracted = await window.extractLayersFromKML(input.files[0]);
      if (extracted?.errorCode) return [];
      const layers = extracted?.layers || [];
      const pointsByLayer = extracted?.pointsByLayer || {};
      const points = [];

      layers.forEach(layerName => {
        if (!isExistingLayer(layerName)) return;
        (pointsByLayer[layerName] || []).forEach(point => {
          const lat = Number(point?.lat);
          const lng = Number(point?.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
          points.push({ name: point?.name || "", lat, lng });
        });
      });

      return points;
    } catch (_) {
      return [];
    }
  }

  function removeOldBox() {
    document.getElementById(BOX_ID)?.remove();
  }

  function render(items) {
    removeOldBox();
    if (!items.length) return;

    const result = document.getElementById("adminReviewResult");
    if (!result) return;

    const box = document.createElement("div");
    box.id = BOX_ID;
    box.style.cssText = "margin:12px 0;padding:10px 12px;border:1px solid rgba(251,191,36,.28);border-radius:12px;background:rgba(245,158,11,.07);color:#fde68a;font-size:12px;line-height:1.6";
    box.innerHTML = `
      <div style="font-weight:900">🕰️ 要確認POIがあります</div>
      <div style="margin-top:3px;color:#cbd5e1;font-size:11px">過去データで長期間確認されていないPOIです。現地やMy Mapsで一度確認してください。</div>
      <details style="margin-top:7px">
        <summary style="cursor:pointer;font-weight:800;color:#fef3c7">対象を見る</summary>
        <div style="margin-top:7px;display:grid;gap:5px">
          ${items.map(item => `<div style="padding:6px 8px;border-radius:8px;background:rgba(15,23,42,.45);color:#e2e8f0">${esc(item.name || "名称なし")}</div>`).join("")}
        </div>
      </details>
    `;

    result.prepend(box);
  }

  async function runFreshnessCheck() {
    const points = await collectExistingPoints();
    if (!points.length) {
      removeOldBox();
      return;
    }
    const items = await invoke(points);
    render(items);
  }

  function wrapReviewFunction() {
    const original = window.runAdminDashboardReview;
    if (typeof original !== "function" || original.__poiFreshnessWrapped) return false;

    const wrapped = async function (...args) {
      removeOldBox();
      const result = await original.apply(this, args);
      try {
        await runFreshnessCheck();
      } catch (error) {
        console.warn("POI確認時期チェックをスキップしました", error);
      }
      return result;
    };
    wrapped.__poiFreshnessWrapped = true;
    window.runAdminDashboardReview = wrapped;
    return true;
  }

  if (!wrapReviewFunction()) {
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (wrapReviewFunction() || tries > 40) clearInterval(timer);
    }, 250);
  }
})();