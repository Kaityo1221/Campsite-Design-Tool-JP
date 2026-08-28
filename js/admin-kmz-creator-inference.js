/* 管理者画面: 過去KMZの作成者復元表示 */
(function () {
  "use strict";

  const FUNCTION_NAME = "admin-kmz-creator-inference";
  const STYLE_ID = "adminKmzCreatorInferenceStyles";
  const recordsById = new Map();
  let summary = null;
  let loading = false;
  let lastLoadedAt = 0;

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .ak-creator-block{grid-column:1/-1;padding:10px 11px;border:1px solid rgba(148,163,184,.18);border-radius:12px;background:rgba(15,23,42,.7)}
      .ak-creator-block.direct{border-color:rgba(74,222,128,.28);background:rgba(22,101,52,.09)}
      .ak-creator-block.inferred{border-color:rgba(250,204,21,.3);background:rgba(133,77,14,.1)}
      .ak-creator-block.ambiguous{border-color:rgba(248,113,113,.3);background:rgba(127,29,29,.1)}
      .ak-creator-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px}
      .ak-creator-head strong{color:#f8fafc;font-size:10px}
      .ak-creator-badge{padding:3px 6px;border-radius:999px;font-size:8px;font-weight:900;white-space:nowrap}
      .ak-creator-badge.direct{background:rgba(34,197,94,.15);color:#bbf7d0}
      .ak-creator-badge.inferred{background:rgba(234,179,8,.14);color:#fef08a}
      .ak-creator-badge.ambiguous{background:rgba(239,68,68,.14);color:#fecaca}
      .ak-creator-badge.unknown{background:rgba(100,116,139,.18);color:#cbd5e1}
      .ak-creator-name{color:#f8fafc;font-size:11px;font-weight:900;line-height:1.5;overflow-wrap:anywhere}
      .ak-creator-sub{margin-top:3px;color:#94a3b8;font-size:8px;line-height:1.55;overflow-wrap:anywhere}
      .ak-creator-summary{border-color:rgba(250,204,21,.24)!important;background:rgba(133,77,14,.08)!important;color:#fde68a!important}
    `;
    document.head.appendChild(style);
  }

  function creatorMarkup(item) {
    const source = item?.source || "unknown";

    if (source === "direct") {
      return `
        <div class="ak-creator-block direct" data-ak-creator-block>
          <div class="ak-creator-head"><strong>👤 作成者</strong><span class="ak-creator-badge direct">Discord認証・確定</span></div>
          <div class="ak-creator-name">${esc(item.displayName || "-")}</div>
          <div class="ak-creator-sub">Discord User ID: ${esc(item.discordUserId || "-")}</div>
        </div>`;
    }

    if (source === "device_inferred") {
      return `
        <div class="ak-creator-block inferred" data-ak-creator-block>
          <div class="ak-creator-head"><strong>🧭 推定作成者</strong><span class="ak-creator-badge inferred">同一端末から推定</span></div>
          <div class="ak-creator-name">${esc(item.displayName || "-")}</div>
          <div class="ak-creator-sub">Discord User ID: ${esc(item.discordUserId || "-")}<br>同じ匿名端末で確認できた認証済み履歴 ${Number(item.evidenceCount) || 0}件を根拠に推定。確定情報としては扱いません。</div>
        </div>`;
    }

    if (source === "ambiguous") {
      return `
        <div class="ak-creator-block ambiguous" data-ak-creator-block>
          <div class="ak-creator-head"><strong>👥 作成者</strong><span class="ak-creator-badge ambiguous">判定不能</span></div>
          <div class="ak-creator-name">同一端末に複数のDiscordユーザー</div>
          <div class="ak-creator-sub">この匿名端末には ${Number(item.deviceCreatorCount) || 2}人の認証済みユーザー履歴があるため、過去分は推定しません。</div>
        </div>`;
    }

    return `
      <div class="ak-creator-block" data-ak-creator-block>
        <div class="ak-creator-head"><strong>👤 作成者</strong><span class="ak-creator-badge unknown">記録なし</span></div>
        <div class="ak-creator-name">まだ復元できません</div>
        <div class="ak-creator-sub">同じ端末でDiscord認証後に新しいKMZ作成・距離チェックを行うと、過去履歴の推定候補になります。</div>
      </div>`;
  }

  function getRecordId(card) {
    return card.querySelector("[data-ak-download]")?.dataset.akDownload ||
      card.querySelector("[data-ak-review]")?.dataset.akReview || "";
  }

  function enhanceCard(card) {
    if (!(card instanceof HTMLElement)) return;
    const recordId = getRecordId(card);
    if (!recordId) return;
    const item = recordsById.get(recordId);
    if (!item) return;

    const meta = card.querySelector(".ak-meta");
    if (!meta) return;

    meta.querySelector("[data-ak-creator-block]")?.remove();
    meta.insertAdjacentHTML("afterbegin", creatorMarkup(item));
  }

  function enhanceAll(root = document) {
    const scope = root?.querySelectorAll ? root : document;
    if (scope.matches?.(".ak-card")) enhanceCard(scope);
    scope.querySelectorAll?.(".ak-card").forEach(enhanceCard);
    renderSummary();
  }

  function renderSummary() {
    if (!summary) return;
    const pills = document.querySelector("#adminKmzBrowserV2 .ak-pills");
    if (!pills) return;

    let pill = pills.querySelector("[data-ak-creator-summary]");
    if (!pill) {
      pill = document.createElement("span");
      pill.className = "ak-pill ak-creator-summary";
      pill.dataset.akCreatorSummary = "1";
      pills.appendChild(pill);
    }

    pill.textContent = `作成者復元: 確定 ${Number(summary.direct) || 0} / 推定 ${Number(summary.inferred) || 0} / 判定不能 ${Number(summary.ambiguous) || 0} / 未判定 ${Number(summary.unknown) || 0}`;
  }

  async function loadCreatorData(force = false) {
    if (loading) return;
    const now = Date.now();
    if (!force && recordsById.size && now - lastLoadedAt < 5000) {
      enhanceAll(document);
      return;
    }

    const sessionToken = window.CampsiteAdminAuth?.getSessionToken?.() || "";
    if (!sessionToken || !window.campsiteSupabase?.functions) return;

    loading = true;
    try {
      const { data, error } = await window.campsiteSupabase.functions.invoke(
        FUNCTION_NAME,
        { body: { sessionToken } }
      );
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "作成者推定情報を取得できませんでした。");

      recordsById.clear();
      (Array.isArray(data.records) ? data.records : []).forEach(item => {
        if (item?.recordId) recordsById.set(String(item.recordId), item);
      });
      summary = data.summary || null;
      lastLoadedAt = Date.now();
      enhanceAll(document);
    } catch (error) {
      console.warn("作成者推定情報の読み込みに失敗しました。", error);
    } finally {
      loading = false;
    }
  }

  function start() {
    ensureStyles();

    document.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target.closest("[data-ak-refresh]") : null;
      if (target) setTimeout(() => loadCreatorData(true), 250);
    });

    const observer = new MutationObserver((mutations) => {
      let sawCard = false;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.matches?.(".ak-card") || node.querySelector?.(".ak-card")) sawCard = true;
        }
      }
      if (!sawCard) return;
      if (recordsById.size) enhanceAll(document);
      else setTimeout(() => loadCreatorData(false), 80);
    });

    observer.observe(document.body, { childList: true, subtree: true });

    if (document.querySelector(".ak-card")) loadCreatorData(false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
