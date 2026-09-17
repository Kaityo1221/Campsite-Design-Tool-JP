/* iPhone Safari tap fallback for PRE-CHECK action chips.
   Capture actionable chips before scroll/map handlers swallow the synthetic click. */
(function () {
  "use strict";

  if (window.AdminPrecheckTapFix) return;

  let lastTouchAt = 0;
  let touchStart = null;

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function chipKey(target) {
    const chip = target?.closest?.(".apc-chip[data-apc-detail]");
    return chip ? { chip, key: chip.dataset.apcDetail || "" } : null;
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

  function closeSheet() {
    document.querySelectorAll(".apd-backdrop").forEach(node => node.remove());
  }

  function openSheet(key) {
    const result = window.AdminAutoReview?.getResult?.();
    const detail = detailPayload(key, result);
    closeSheet();
    const backdrop = document.createElement("div");
    backdrop.className = "apd-backdrop";
    backdrop.innerHTML = `<section class="apd-sheet" role="dialog" aria-modal="true" aria-label="${esc(detail.title)}"><header class="apd-head"><div><span class="apd-kicker">PRE-CHECK DETAIL</span><h3>${esc(detail.title)}</h3></div><button type="button" class="apd-close" aria-label="閉じる">×</button></header><div class="apd-body">${detail.body}</div></section>`;
    document.body.appendChild(backdrop);
    backdrop.querySelector(".apd-close")?.addEventListener("click", event => { event.preventDefault(); closeSheet(); });
    backdrop.addEventListener("click", event => { if (event.target === backdrop) closeSheet(); });
  }

  function activate(event) {
    const hit = chipKey(event.target);
    if (!hit?.key) return false;
    event.preventDefault?.();
    event.stopPropagation?.();
    event.stopImmediatePropagation?.();
    openSheet(hit.key);
    return true;
  }

  document.addEventListener("touchstart", event => {
    const hit = chipKey(event.target);
    if (!hit) { touchStart = null; return; }
    const t = event.touches?.[0];
    touchStart = t ? { x: t.clientX, y: t.clientY } : null;
  }, { capture: true, passive: true });

  document.addEventListener("touchend", event => {
    const hit = chipKey(event.target);
    if (!hit || !touchStart) return;
    const t = event.changedTouches?.[0];
    const moved = t ? Math.hypot(t.clientX - touchStart.x, t.clientY - touchStart.y) : 0;
    touchStart = null;
    if (moved > 12) return;
    lastTouchAt = Date.now();
    activate(event);
  }, { capture: true, passive: false });

  document.addEventListener("click", event => {
    if (Date.now() - lastTouchAt < 700) {
      const hit = chipKey(event.target);
      if (hit) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
      return;
    }
    activate(event);
  }, true);

  window.AdminPrecheckTapFix = Object.freeze({ openDetail: openSheet, closeDetail: closeSheet });
})();
