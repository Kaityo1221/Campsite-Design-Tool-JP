/* ======================================================
   Admin PRE-CHECK summary
   - Shows the scoped automatic-check result immediately
   - Keeps Scopely/Niantic formal review separate from this tool
====================================================== */
(function () {
  "use strict";

  if (window.AdminPrecheckSummary) return;

  let renderTimer = null;

  function ensureStyles() {
    if (document.getElementById("adminPrecheckSummaryStyles")) return;
    const style = document.createElement("style");
    style.id = "adminPrecheckSummaryStyles";
    style.textContent = `
      .apc-summary{flex:0 0 auto;display:flex;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid rgba(148,163,184,.12);background:#06101d;color:#e2e8f0}
      .apc-mark{flex:0 0 auto;min-width:112px}.apc-label{color:#64748b;font-size:8px;font-weight:1000;letter-spacing:.16em}.apc-result{display:block;margin-top:2px;color:#f8fafc;font-size:15px;font-weight:1000;line-height:1.25}.apc-summary.good .apc-result{color:#86efac}.apc-summary.warn .apc-result{color:#fde68a}.apc-summary.hold .apc-result{color:#cbd5e1}.apc-summary.wait .apc-result{color:#94a3b8}
      .apc-meta{min-width:0;display:flex;align-items:center;gap:7px;overflow-x:auto;scrollbar-width:none}.apc-meta::-webkit-scrollbar{display:none}.apc-chip{flex:0 0 auto;padding:4px 7px;border:1px solid rgba(148,163,184,.15);border-radius:999px;background:rgba(15,23,42,.72);color:#94a3b8;font-size:9px;font-weight:900;white-space:nowrap}.apc-chip b{color:#f8fafc}.apc-note{color:#64748b;font-size:9px;line-height:1.4}
      @media(max-width:680px){.apc-summary{gap:9px;padding:8px 10px}.apc-mark{min-width:104px}.apc-result{font-size:14px}.apc-chip{font-size:8px;padding:3px 6px}.apc-note{font-size:8px}}
    `;
    document.head.appendChild(style);
  }

  function workspace() {
    return document.getElementById("adminReviewWorkspace");
  }

  function ensureUi() {
    const root = workspace();
    if (!root) return null;
    let el = root.querySelector("#adminPrecheckSummary");
    if (el) return el;
    el = document.createElement("section");
    el.id = "adminPrecheckSummary";
    el.className = "apc-summary wait";
    const topbar = root.querySelector(".arw-topbar");
    if (topbar?.parentNode) topbar.insertAdjacentElement("afterend", el);
    else root.prepend(el);
    renderWaiting("チェック中…", "KMZを読み込んでいます");
    return el;
  }

  function setClass(kind) {
    const el = ensureUi();
    if (!el) return null;
    el.className = `apc-summary ${kind}`;
    return el;
  }

  function renderWaiting(title = "チェック中…", note = "") {
    const el = setClass("wait");
    if (!el) return;
    el.innerHTML = `<div class="apc-mark"><span class="apc-label">PRE-CHECK</span><strong class="apc-result">${title}</strong></div><div class="apc-meta"><span class="apc-note">${note}</span></div>`;
  }

  function chip(label, value) {
    return `<span class="apc-chip">${label} <b>${value}</b></span>`;
  }

  function render(result) {
    if (!result) {
      renderWaiting();
      return;
    }

    if (!result.ready) {
      const el = setClass("hold");
      if (!el) return;
      el.innerHTML = `<div class="apc-mark"><span class="apc-label">PRE-CHECK</span><strong class="apc-result">○ 範囲未指定</strong></div><div class="apc-meta"><span class="apc-note">チェック範囲を保存すると自動チェックします</span></div>`;
      return;
    }

    const spacing = Array.isArray(result.spacingPairs) ? result.spacingPairs.length : 0;
    const duplicates = Array.isArray(result.duplicatePairs) ? result.duplicatePairs.length : 0;
    const limits = Array.isArray(result.limitWarnings) ? result.limitWarnings.length : 0;
    const unknown = Number(result.counts?.unknown) || 0;
    const outsideAdded = Number(result.outsideAdded) || 0;
    const issues = spacing + duplicates + limits + (outsideAdded > 0 ? 1 : 0);
    const scoped = Array.isArray(result.scoped) ? result.scoped.length : 0;
    const added = Number(result.counts?.totalAdded) || 0;

    let kind = "good";
    let title = "✅ 問題なし";
    if (issues > 0) {
      kind = "warn";
      title = `⚠️ 確認あり ${issues}件`;
    } else if (unknown > 0) {
      kind = "hold";
      title = `○ 未分類 ${unknown}件`;
    }

    const el = setClass(kind);
    if (!el) return;
    el.innerHTML = `
      <div class="apc-mark"><span class="apc-label">PRE-CHECK</span><strong class="apc-result">${title}</strong></div>
      <div class="apc-meta">
        ${chip("対象", scoped)}
        ${chip("追加", added)}
        ${chip("距離", spacing)}
        ${chip("上限", limits)}
        ${chip("重複", duplicates)}
        ${outsideAdded ? chip("範囲外追加", outsideAdded) : ""}
        ${unknown ? chip("未分類", unknown) : ""}
      </div>`;
  }

  function scheduleRender(result) {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      const latest = window.AdminAutoReview?.getResult?.() || result || null;
      render(latest);
    }, 120);
  }

  window.addEventListener("adminautoreviewchange", event => scheduleRender(event.detail?.result));
  window.addEventListener("adminreviewscopechange", () => {
    renderWaiting("再チェック中…", "チェック範囲を反映しています");
    window.AdminAutoReview?.refresh?.();
  });

  const observer = new MutationObserver(records => {
    for (const record of records) {
      const target = record.target;
      if (!(target instanceof Element) || target.id !== "adminReviewWorkspace") continue;
      if (target.classList.contains("open")) {
        ensureUi();
        renderWaiting();
        window.AdminAutoReview?.refresh?.();
      }
    }
  });
  observer.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ["class"] });

  ensureStyles();
  ensureUi();

  window.AdminPrecheckSummary = Object.freeze({ render, refresh: () => window.AdminAutoReview?.refresh?.() });
})();
