/* ======================================================
   Admin PRE-CHECK polish
   - Renames review-oriented UI into pre-check language
   - Keeps formal Scopely/Niantic review separate
   - Lets PRE-CHECK issue chips open a compact detail sheet
====================================================== */
(function () {
  "use strict";

  if (window.AdminPrecheckPolish) return;

  let queued = false;
  let sheet = null;
  let lastDetailKey = "";

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function setText(el, value) {
    if (!el) return;
    const next = String(value ?? "");
    if ((el.textContent || "") !== next) el.textContent = next;
  }

  function ensureStyles() {
    if (document.getElementById("adminPrecheckPolishStyles")) return;
    const style = document.createElement("style");
    style.id = "adminPrecheckPolishStyles";
    style.textContent = `
      .apc-chip.apc-action-chip{cursor:pointer;touch-action:manipulation;border-color:rgba(125,211,252,.28);color:#bae6fd}.apc-chip.apc-action-chip:active{transform:translateY(1px);background:rgba(14,165,233,.13)}
      .apd-backdrop{position:fixed;inset:0;z-index:99990;background:rgba(2,6,23,.52);display:flex;align-items:flex-end;justify-content:center;padding:0}.apd-sheet{width:min(760px,100%);max-height:min(62vh,620px);overflow:hidden;border:1px solid rgba(148,163,184,.22);border-bottom:0;border-radius:22px 22px 0 0;background:#07111f;color:#e2e8f0;box-shadow:0 -18px 60px rgba(0,0,0,.45);display:flex;flex-direction:column}
      .apd-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px 11px;border-bottom:1px solid rgba(148,163,184,.12)}.apd-head div{min-width:0}.apd-kicker{display:block;color:#64748b;font-size:8px;font-weight:1000;letter-spacing:.16em}.apd-head h3{margin:2px 0 0;color:#f8fafc;font-size:16px}.apd-close{width:36px;height:36px;border:1px solid rgba(148,163,184,.18);border-radius:50%;background:rgba(15,23,42,.8);color:#e2e8f0;font-size:18px;font-weight:900}
      .apd-body{overflow:auto;padding:10px 14px calc(18px + env(safe-area-inset-bottom));-webkit-overflow-scrolling:touch}.apd-row{display:grid;grid-template-columns:64px 1fr;gap:9px;padding:10px 2px;border-bottom:1px solid rgba(148,163,184,.09);font-size:11px;line-height:1.5}.apd-row:last-child{border-bottom:0}.apd-row strong{color:#fde68a}.apd-row span{min-width:0;overflow-wrap:anywhere;color:#cbd5e1}.apd-empty{padding:22px 8px;color:#94a3b8;text-align:center;font-size:11px}.apd-note{margin:0 0 8px;color:#94a3b8;font-size:10px;line-height:1.6}.apd-limit{padding:10px 11px;margin:7px 0;border:1px solid rgba(245,158,11,.22);border-radius:11px;background:rgba(245,158,11,.05);color:#fde68a;font-size:11px;font-weight:900}.apd-unknown{padding:12px;border:1px solid rgba(148,163,184,.18);border-radius:11px;background:rgba(148,163,184,.06);color:#cbd5e1;font-size:11px;line-height:1.6}
      @media(min-width:861px){.apd-backdrop{align-items:center;padding:24px}.apd-sheet{border-bottom:1px solid rgba(148,163,184,.22);border-radius:22px;max-height:min(70vh,700px)}}
    `;
    document.head.appendChild(style);
  }

  function replacePlainText(el, replacements) {
    if (!el || el.children.length !== 0) return;
    let next = el.textContent || "";
    replacements.forEach(([from, to]) => { next = next.replace(from, to); });
    setText(el, next);
  }

  function relabelUi() {
    const queue = document.getElementById("adminSiteReviewList");
    if (queue) {
      setText(queue.querySelector(".asr-eyebrow"), "ADMIN · PRE-CHECK");
      setText(queue.querySelector(".asr-head h3"), "🔍 提出前チェック");
      setText(queue.querySelector(".asr-head p:not(.asr-eyebrow)"), "同じサイトの提出履歴をまとめて、提出前の確認ポイントをチェックします。正式な審査は運営側で行います。");
      queue.querySelectorAll(".asr-open").forEach(button => {
        setText(button, "チェックを開く");
        if (button.getAttribute("aria-label") !== "このサイトの提出前チェックを開く") button.setAttribute("aria-label", "このサイトの提出前チェックを開く");
      });
      queue.querySelectorAll(".asr-pill,.asr-state").forEach(el => replacePlainText(el, [[/審査サイト/g, "サイト"], [/審査対象/g, "チェック対象"]]));
    }

    document.querySelectorAll("[data-ak-review]").forEach(button => {
      setText(button, "🔍 提出前チェック");
      if (button.getAttribute("aria-label") !== "このサイトの提出前チェックを開く") button.setAttribute("aria-label", "このサイトの提出前チェックを開く");
    });

    const workspace = document.getElementById("adminReviewWorkspace");
    if (workspace) {
      setText(workspace.querySelector(".arw-eyebrow"), "ADMIN · PRE-CHECK");
      const title = workspace.querySelector("#arwSiteTitle");
      if (title && /審査ワークスペース/.test(title.textContent || "")) setText(title, "提出前チェック");
      workspace.querySelectorAll("[data-arw-legacy],[data-arw-inline-legacy]").forEach(button => { if (button.style.display !== "none") button.style.display = "none"; });
      workspace.querySelectorAll(".arr-panel").forEach(panel => { if (panel.style.display !== "none") panel.style.display = "none"; });
    }

    const scope = document.getElementById("adminReviewScopeControl");
    if (scope) {
      setText(scope.querySelector(".ars-head strong"), "チェック範囲");
      const counts = scope.querySelector("[data-ars-counts]");
      if (counts && counts.innerHTML.includes("審査対象")) counts.innerHTML = counts.innerHTML.replace(/審査対象/g, "チェック対象");
      replacePlainText(scope.querySelector("[data-ars-help]"), [[/審査範囲/g, "チェック範囲"]]);
    }

    document.querySelectorAll(".aar-note,.aar-foot,.apc-note").forEach(el => replacePlainText(el, [
      [/審査範囲/g, "チェック範囲"],
      [/審査対象/g, "チェック対象"],
      [/最終審査結果/g, "正式判断"]
    ]));

    wirePrecheckChips();
  }

  function detailCount(chip) {
    const match = String(chip?.textContent || "").match(/(-?\d+)/);
    return match ? Number(match[1]) : 0;
  }

  function chipKey(chip) {
    const text = String(chip?.textContent || "").trim();
    if (text.startsWith("距離")) return "spacing";
    if (text.startsWith("上限")) return "limits";
    if (text.startsWith("重複")) return "duplicates";
    if (text.startsWith("未分類")) return "unknown";
    return "";
  }

  function wirePrecheckChips() {
    const summary = document.getElementById("adminPrecheckSummary");
    if (!summary) return;
    summary.querySelectorAll(".apc-chip").forEach(chip => {
      const key = chipKey(chip);
      const count = detailCount(chip);
      if (!key || count <= 0) {
        chip.classList.remove("apc-action-chip");
        chip.removeAttribute("role");
        chip.removeAttribute("tabindex");
        delete chip.dataset.apcDetail;
        return;
      }
      chip.classList.add("apc-action-chip");
      chip.dataset.apcDetail = key;
      chip.setAttribute("role", "button");
      chip.setAttribute("tabindex", "0");
      const label = `${chip.textContent.trim()}の詳細を表示`;
      if (chip.getAttribute("aria-label") !== label) chip.setAttribute("aria-label", label);
    });
  }

  function closeSheet() {
    if (sheet?.isConnected) sheet.remove();
    sheet = null;
    lastDetailKey = "";
  }

  function pairRows(pairs) {
    if (!Array.isArray(pairs) || !pairs.length) return `<div class="apd-empty">該当項目はありません。</div>`;
    return [...pairs]
      .sort((a, b) => Number(a.distance || 0) - Number(b.distance || 0))
      .map(pair => `<div class="apd-row"><strong>${Number(pair.distance || 0).toFixed(1)}m</strong><span>${esc(pair.a?.name || "名称なし")} ↔ ${esc(pair.b?.name || "名称なし")}</span></div>`)
      .join("");
  }

  function detailPayload(key, result) {
    if (!result?.ready) return { title: "チェック範囲未指定", body: `<div class="apd-empty">チェック範囲を保存すると詳細を確認できます。</div>` };
    if (key === "spacing") {
      const count = result.spacingPairs?.length || 0;
      return { title: `距離の確認 ${count}組`, body: `<p class="apd-note">追加予定POIを含む、基準距離未満の組み合わせです。短い順に表示しています。</p>${pairRows(result.spacingPairs)}` };
    }
    if (key === "duplicates") {
      const count = result.duplicatePairs?.length || 0;
      return { title: `重複候補 ${count}組`, body: `<p class="apd-note">1m未満の組み合わせを重複候補として表示しています。</p>${pairRows(result.duplicatePairs)}` };
    }
    if (key === "limits") {
      const warnings = Array.isArray(result.limitWarnings) ? result.limitWarnings : [];
      return {
        title: `上限の確認 ${warnings.length}件`,
        body: warnings.length
          ? warnings.map(item => `<div class="apd-limit">${esc(item.label)} ${Number(item.count) || 0} / 上限 ${item.limit === null ? "無制限" : esc(item.limit)}</div>`).join("")
          : `<div class="apd-empty">上限超過はありません。</div>`
      };
    }
    if (key === "unknown") {
      const count = Number(result.counts?.unknown) || 0;
      return { title: `未分類 ${count}件`, body: `<div class="apd-unknown">種類を判別できない追加POIが ${count}件あります。種類別上限の判定では、この件数分を保留しています。</div>` };
    }
    return { title: "PRE-CHECK", body: `<div class="apd-empty">詳細はありません。</div>` };
  }

  function openSheet(key) {
    const result = window.AdminAutoReview?.getResult?.();
    const detail = detailPayload(key, result);
    if (sheet?.isConnected) sheet.remove();
    ensureStyles();
    const backdrop = document.createElement("div");
    backdrop.className = "apd-backdrop";
    backdrop.innerHTML = `<section class="apd-sheet" role="dialog" aria-modal="true" aria-label="${esc(detail.title)}"><header class="apd-head"><div><span class="apd-kicker">PRE-CHECK DETAIL</span><h3>${esc(detail.title)}</h3></div><button type="button" class="apd-close" aria-label="閉じる">×</button></header><div class="apd-body">${detail.body}</div></section>`;
    document.body.appendChild(backdrop);
    sheet = backdrop;
    lastDetailKey = key;
    backdrop.querySelector(".apd-close")?.addEventListener("click", closeSheet);
    backdrop.addEventListener("click", event => { if (event.target === backdrop) closeSheet(); });
  }

  document.addEventListener("click", event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const chip = target.closest?.(".apc-chip[data-apc-detail]");
    if (!chip) return;
    event.preventDefault();
    event.stopPropagation();
    openSheet(chip.dataset.apcDetail);
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeSheet();
    if ((event.key === "Enter" || event.key === " ") && event.target instanceof Element && event.target.matches(".apc-chip[data-apc-detail]")) {
      event.preventDefault();
      openSheet(event.target.dataset.apcDetail);
    }
  });

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      relabelUi();
    });
  }

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  window.addEventListener("adminautoreviewchange", () => {
    schedule();
    if (lastDetailKey && sheet) openSheet(lastDetailKey);
  });
  window.addEventListener("adminreviewscopechange", schedule);

  ensureStyles();
  schedule();

  window.AdminPrecheckPolish = Object.freeze({ refresh: schedule, closeDetail: closeSheet });
})();
