/* 管理者画面: 推測地点カードの詳細折りたたみ */
(function () {
  "use strict";

  const STYLE_ID = "adminKmzCardCollapseStyles";
  const CARD_SELECTOR = ".ak-card";
  const ENHANCED_ATTR = "data-ak-collapsible";

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .ak-card[${ENHANCED_ATTR}="1"]{padding:0}
      .ak-card-collapse{margin:0}
      .ak-card-collapse>summary{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:48px;padding:13px 15px;cursor:pointer;list-style:none;color:#f8fafc;font-size:14px;font-weight:900;line-height:1.5;overflow-wrap:anywhere;user-select:none}
      .ak-card-collapse>summary::-webkit-details-marker{display:none}
      .ak-card-collapse>summary::after{content:"⌄";flex:0 0 auto;color:#7dd3fc;font-size:18px;font-weight:800;line-height:1;transition:transform .18s ease}
      .ak-card-collapse[open]>summary::after{transform:rotate(180deg)}
      .ak-card-collapse-body{padding:0 14px 14px;border-top:1px solid rgba(148,163,184,.12)}
      .ak-card-collapse-body>.ak-card-top{margin-top:10px}
      .ak-card-collapse-body .ak-title:empty{display:none}
      @media(max-width:680px){.ak-card-collapse>summary{padding:12px 13px}.ak-card-collapse-body{padding:0 13px 13px}}
    `;
    document.head.appendChild(style);
  }

  function enhanceCard(card) {
    if (!(card instanceof HTMLElement)) return;
    if (card.getAttribute(ENHANCED_ATTR) === "1") return;

    const top = card.querySelector(":scope > .ak-card-top");
    const title = top?.querySelector(".ak-title h4");
    if (!top || !title) return;

    const name = title.textContent?.trim() || "名称不明";
    title.remove();

    const details = document.createElement("details");
    details.className = "ak-card-collapse";

    const summary = document.createElement("summary");
    summary.textContent = name;
    summary.setAttribute("aria-label", `${name} の詳細を開く`);

    const detailBody = document.createElement("div");
    detailBody.className = "ak-card-collapse-body";

    while (card.firstChild) {
      detailBody.appendChild(card.firstChild);
    }

    details.append(summary, detailBody);
    card.appendChild(details);
    card.setAttribute(ENHANCED_ATTR, "1");
  }

  function enhanceAll(root) {
    const scope = root?.querySelectorAll ? root : document;
    if (scope.matches?.(CARD_SELECTOR)) enhanceCard(scope);
    scope.querySelectorAll?.(`${CARD_SELECTOR}:not([${ENHANCED_ATTR}="1"])`).forEach(enhanceCard);
  }

  function start() {
    ensureStyles();
    enhanceAll(document);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          enhanceAll(node);
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
