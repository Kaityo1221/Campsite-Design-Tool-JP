/* 管理者画面: 推測地点カードの詳細折りたたみ + 作成者表示 */
(function () {
  "use strict";

  const STYLE_ID = "adminKmzCardCollapseStyles";
  const CARD_SELECTOR = ".ak-card";
  const ENHANCED_ATTR = "data-ak-collapsible";
  const CREATOR_ATTR = "data-ak-creator-ready";
  const FUNCTION_NAME = "admin-kmz-access";

  let creatorIndex = new Map();
  let creatorLoading = null;
  let creatorFetchedAt = 0;

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .ak-card[${ENHANCED_ATTR}="1"]{padding:0}
      .ak-card[${ENHANCED_ATTR}="1"]>.ak-card-collapse{margin:0}
      .ak-card[${ENHANCED_ATTR}="1"]>.ak-card-collapse>summary{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:48px;padding:13px 15px;cursor:pointer;list-style:none;color:#f8fafc;font-size:14px;font-weight:900;line-height:1.5;overflow-wrap:anywhere;user-select:none}
      .ak-card[${ENHANCED_ATTR}="1"]>.ak-card-collapse>summary::-webkit-details-marker{display:none}
      .ak-card[${ENHANCED_ATTR}="1"]>.ak-card-collapse>summary::after{content:"⌄";flex:0 0 auto;color:#7dd3fc;font-size:18px;font-weight:800;line-height:1;transition:transform .18s ease}
      .ak-card[${ENHANCED_ATTR}="1"]>.ak-card-collapse[open]>summary::after{transform:rotate(180deg)}
      .ak-card[${ENHANCED_ATTR}="1"]>.ak-card-collapse:not([open])~*{display:none!important}
      .ak-card[${ENHANCED_ATTR}="1"]>.ak-card-top{margin:0;padding:10px 14px 0}
      .ak-card[${ENHANCED_ATTR}="1"]>.ak-card-top .ak-title h4{display:none}
      .ak-card[${ENHANCED_ATTR}="1"]>.ak-creator-line{margin:10px 14px 0;padding:10px 12px;border:1px solid rgba(167,139,250,.2);border-radius:11px;background:rgba(124,58,237,.07);color:#cbd5e1;font-size:9px;line-height:1.55}
      .ak-card[${ENHANCED_ATTR}="1"]>.ak-creator-line strong{display:block;margin-bottom:2px;color:#ede9fe;font-size:11px;overflow-wrap:anywhere}
      .ak-card[${ENHANCED_ATTR}="1"]>.ak-creator-line small{color:#7c8aa0;font-size:8px;overflow-wrap:anywhere}
      .ak-card[${ENHANCED_ATTR}="1"]>.ak-meta{margin:12px 14px 0}
      .ak-card[${ENHANCED_ATTR}="1"]>.ak-actions{margin:12px 14px 14px}
      .ak-card[${ENHANCED_ATTR}="1"]>.admin-kmz-quick{margin:11px 14px 0}
      .ak-card[${ENHANCED_ATTR}="1"]>.admin-kmz-detail{margin:8px 14px 0}
      .admin-kmz-map-launch{display:flex;align-items:center;justify-content:center;gap:7px;width:calc(100% - 44px);margin:0 22px 14px;padding:11px 14px;border:1px solid rgba(56,189,248,.34);border-radius:12px;background:linear-gradient(135deg,rgba(14,165,233,.15),rgba(99,102,241,.13));color:#e0f2fe;font-size:11px;font-weight:900;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(125,211,252,.05)}
      .admin-kmz-map-launch:hover{border-color:rgba(125,211,252,.58);background:linear-gradient(135deg,rgba(14,165,233,.22),rgba(99,102,241,.18))}
      @media(max-width:680px){.ak-card[${ENHANCED_ATTR}="1"]>.ak-card-collapse>summary{padding:12px 13px}.ak-card[${ENHANCED_ATTR}="1"]>.ak-card-top{padding-left:13px;padding-right:13px}.ak-card[${ENHANCED_ATTR}="1"]>.ak-creator-line,.ak-card[${ENHANCED_ATTR}="1"]>.ak-meta,.ak-card[${ENHANCED_ATTR}="1"]>.admin-kmz-quick,.ak-card[${ENHANCED_ATTR}="1"]>.admin-kmz-detail{margin-left:13px;margin-right:13px}.ak-card[${ENHANCED_ATTR}="1"]>.ak-actions{margin-left:13px;margin-right:13px;margin-bottom:13px}.admin-kmz-map-launch{width:calc(100% - 28px);margin-left:14px;margin-right:14px}}
    `;
    document.head.appendChild(style);
  }

  function ensureMapViewerButton() {
    const root = document.getElementById("adminKmzBrowserV2");
    if (!root || root.querySelector("[data-admin-kmz-map-launch]")) return;

    const body = root.querySelector("#adminKmzBrowserV2Body");
    if (!body) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "admin-kmz-map-launch";
    button.dataset.adminKmzMapLaunch = "1";
    button.textContent = "🗺 MAPで確認";
    button.addEventListener("click", () => {
      window.location.href = "admin-kmz-map.html";
    });
    root.insertBefore(button, body);
  }

  function recordIdForCard(card) {
    return card.querySelector("[data-ak-download]")?.dataset?.akDownload || "";
  }

  function renderCreator(card) {
    if (!(card instanceof HTMLElement)) return;
    if (card.getAttribute(CREATOR_ATTR) === "1") return;

    const recordId = recordIdForCard(card);
    if (!recordId) return;
    const record = creatorIndex.get(recordId);
    if (!record) return;

    const line = document.createElement("div");
    line.className = "ak-creator-line";

    const label = document.createElement("strong");
    if (record.hasCreatorIdentity) {
      label.textContent = `👤 作成者　${record.creatorDisplayName || "作成者"}`;
      line.appendChild(label);

      const id = document.createElement("small");
      id.textContent = `Discord User ID: ${record.creatorDiscordUserId || "-"}`;
      line.appendChild(id);
    } else {
      label.textContent = "👤 作成者　記録なし";
      line.appendChild(label);

      const note = document.createElement("small");
      note.textContent = "Discord認証の作成者記録を開始する前の履歴です";
      line.appendChild(note);
    }

    const top = card.querySelector(":scope > .ak-card-top");
    if (top) top.insertAdjacentElement("afterend", line);
    else card.appendChild(line);
    card.setAttribute(CREATOR_ATTR, "1");
  }

  function renderCreators(root = document) {
    const scope = root?.querySelectorAll ? root : document;
    if (scope.matches?.(CARD_SELECTOR)) renderCreator(scope);
    scope.querySelectorAll?.(`${CARD_SELECTOR}:not([${CREATOR_ATTR}="1"])`).forEach(renderCreator);
  }

  async function loadCreatorIndex(force = false) {
    if (!window.CampsiteAdminAuth?.isUnlocked?.()) return;
    if (!window.campsiteSupabase?.functions) return;
    if (creatorLoading) return creatorLoading;
    if (!force && creatorIndex.size && Date.now() - creatorFetchedAt < 30000) {
      renderCreators(document);
      return;
    }

    const sessionToken = window.CampsiteAdminAuth?.getSessionToken?.() || "";
    if (!sessionToken) return;

    creatorLoading = (async () => {
      try {
        const { data, error } = await window.campsiteSupabase.functions.invoke(FUNCTION_NAME, {
          body: {
            action: "list",
            sessionToken,
            currentDeviceId: localStorage.getItem("campsiteUserId") || ""
          }
        });
        if (error || !data?.success) return;

        const next = new Map();
        [...(data.historyRecords || []), ...(data.uniqueRecords || [])].forEach(record => {
          if (record?.id) next.set(String(record.id), record);
        });
        creatorIndex = next;
        creatorFetchedAt = Date.now();
        document.querySelectorAll(`[${CREATOR_ATTR}="1"]`).forEach(card => {
          card.removeAttribute(CREATOR_ATTR);
          card.querySelector(":scope > .ak-creator-line")?.remove();
        });
        renderCreators(document);
      } catch (error) {
        console.warn("作成者情報の取得をスキップしました", error);
      } finally {
        creatorLoading = null;
      }
    })();

    return creatorLoading;
  }

  function enhanceCard(card) {
    if (!(card instanceof HTMLElement)) return;
    if (card.getAttribute(ENHANCED_ATTR) === "1") {
      renderCreator(card);
      return;
    }

    const top = card.querySelector(":scope > .ak-card-top");
    const title = top?.querySelector(".ak-title h4");
    if (!top || !title) return;

    const name = title.textContent?.trim() || "名称不明";
    const details = document.createElement("details");
    details.className = "ak-card-collapse";

    const summary = document.createElement("summary");
    summary.textContent = name;

    details.appendChild(summary);
    card.insertBefore(details, card.firstChild);
    card.setAttribute(ENHANCED_ATTR, "1");
    renderCreator(card);
  }

  function enhanceAll(root) {
    ensureMapViewerButton();
    const scope = root?.querySelectorAll ? root : document;
    if (scope.matches?.(CARD_SELECTOR)) enhanceCard(scope);
    scope.querySelectorAll?.(`${CARD_SELECTOR}:not([${ENHANCED_ATTR}="1"])`).forEach(enhanceCard);
    renderCreators(scope);
  }

  function hasUnknownCard(root) {
    const scope = root?.querySelectorAll ? root : document;
    const cards = [];
    if (scope.matches?.(CARD_SELECTOR)) cards.push(scope);
    scope.querySelectorAll?.(CARD_SELECTOR).forEach(card => cards.push(card));
    return cards.some(card => {
      const id = recordIdForCard(card);
      return id && !creatorIndex.has(id);
    });
  }

  function start() {
    ensureStyles();
    ensureMapViewerButton();
    enhanceAll(document);
    loadCreatorIndex(false);

    const observer = new MutationObserver((mutations) => {
      let shouldRefreshCreators = false;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          enhanceAll(node);
          if (hasUnknownCard(node)) shouldRefreshCreators = true;
        }
      }
      ensureMapViewerButton();
      if (shouldRefreshCreators) loadCreatorIndex(true);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
