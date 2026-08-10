/* ======================================================
   管理者画面: スマホ向け折りたたみUI

   - 未分類POIレビューの説明・判断基準を折りたたむ
   - Recent Reviews / Dictionary Candidatesを初期状態で閉じる
   - 辞書候補は要点だけ先に表示し、詳細操作を折りたたむ
   - 提出KMZカードは主要情報だけ先に表示し、補足情報を折りたたむ
   - 既存のSupabase通信・レビュー処理には触れない
====================================================== */

(function () {
  "use strict";

  const ENHANCED_ATTR = "data-admin-fold-enhanced";

  function ensureStyles() {
    if (document.getElementById("adminMobileFoldersStyles")) return;

    const style = document.createElement("style");
    style.id = "adminMobileFoldersStyles";
    style.textContent = `
      .admin-fold-shell {
        margin: 12px 0;
        border: 1px solid rgba(148, 163, 184, 0.20);
        border-radius: 14px;
        background: rgba(15, 23, 42, 0.46);
        overflow: hidden;
      }

      .admin-fold-shell > summary {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        min-height: 46px;
        box-sizing: border-box;
        padding: 11px 13px;
        color: #e2e8f0;
        font-size: 12px;
        font-weight: 900;
        cursor: pointer;
        list-style: none;
        user-select: none;
      }

      .admin-fold-shell > summary::-webkit-details-marker,
      .admin-kmz-detail > summary::-webkit-details-marker,
      .admin-dictionary-detail > summary::-webkit-details-marker {
        display: none;
      }

      .admin-fold-shell > summary::after {
        content: "＋";
        flex: 0 0 auto;
        color: #7dd3fc;
        font-size: 18px;
        line-height: 1;
      }

      .admin-fold-shell[open] > summary::after {
        content: "−";
      }

      .admin-fold-guide {
        border-color: rgba(56, 189, 248, 0.22);
        background: rgba(14, 165, 233, 0.05);
      }

      .admin-fold-history {
        border-color: rgba(99, 102, 241, 0.22);
      }

      .admin-fold-dictionary {
        border-color: rgba(167, 139, 250, 0.24);
      }

      .admin-fold-intro {
        margin: 0;
        padding: 2px 14px 10px;
      }

      .admin-fold-shell > .alias-review-guide,
      .admin-fold-shell > .alias-review-history-box,
      .admin-fold-shell > .alias-dictionary-candidate-box {
        margin: 0;
        border: 0;
        border-radius: 0;
      }

      .admin-fold-history .alias-review-history-title,
      .admin-fold-dictionary .alias-dictionary-candidate-title {
        display: none;
      }

      .admin-fold-shell > .alias-review-guide,
      .admin-fold-shell > .alias-review-history-box,
      .admin-fold-shell > .alias-dictionary-candidate-box {
        padding-top: 4px;
      }

      .admin-dictionary-detail {
        margin-top: 9px;
        border-top: 1px solid rgba(148, 163, 184, 0.16);
      }

      .admin-dictionary-detail > summary {
        padding: 9px 0 2px;
        color: #a5b4fc;
        font-size: 10px;
        font-weight: 900;
        cursor: pointer;
        list-style: none;
      }

      .admin-dictionary-detail > summary::after {
        content: "  ＋";
      }

      .admin-dictionary-detail[open] > summary::after {
        content: "  −";
      }

      .admin-kmz-quick {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 6px;
        margin-top: 11px;
      }

      .admin-kmz-quick-item {
        min-width: 0;
        padding: 8px 7px;
        border: 1px solid rgba(148, 163, 184, 0.13);
        border-radius: 10px;
        background: rgba(2, 6, 23, 0.28);
        color: #94a3b8;
        font-size: 8px;
        line-height: 1.45;
        overflow-wrap: anywhere;
      }

      .admin-kmz-quick-item strong {
        color: #cbd5e1;
        font-size: 8px;
      }

      .admin-kmz-detail {
        margin-top: 8px;
      }

      .admin-kmz-detail > summary {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 32px;
        padding: 6px 9px;
        box-sizing: border-box;
        border: 1px solid rgba(148, 163, 184, 0.14);
        border-radius: 9px;
        background: rgba(15, 23, 42, 0.36);
        color: #94a3b8;
        font-size: 9px;
        font-weight: 900;
        cursor: pointer;
        list-style: none;
      }

      .admin-kmz-detail > summary::after {
        content: "＋";
        margin-left: 7px;
        color: #7dd3fc;
      }

      .admin-kmz-detail[open] > summary::after {
        content: "−";
      }

      .admin-kmz-detail .ak-meta {
        margin-top: 8px;
        padding: 9px 2px 2px;
        border-top: 1px solid rgba(148, 163, 184, 0.12);
      }

      .admin-kmz-list-fold {
        margin: 0 22px 22px;
        border: 1px solid rgba(56, 189, 248, 0.22);
        border-radius: 14px;
        background: rgba(2, 6, 23, 0.30);
        overflow: hidden;
      }

      .admin-kmz-list-fold > summary {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        min-height: 46px;
        padding: 11px 13px;
        box-sizing: border-box;
        color: #e0f2fe;
        font-size: 11px;
        font-weight: 900;
        cursor: pointer;
        list-style: none;
      }

      .admin-kmz-list-fold > summary::-webkit-details-marker {
        display: none;
      }

      .admin-kmz-list-fold > summary::after {
        content: "＋";
        flex: 0 0 auto;
        color: #38bdf8;
        font-size: 18px;
      }

      .admin-kmz-list-fold[open] > summary::after {
        content: "−";
      }

      .admin-kmz-list-fold > summary small {
        margin-left: auto;
        color: #64748b;
        font-size: 9px;
        font-weight: 800;
      }

      .admin-kmz-list-fold > .ak-wrap {
        padding: 10px 12px 14px;
      }

      @media (max-width: 680px) {
        .admin-fold-shell {
          margin: 10px 0;
        }

        .admin-fold-shell > summary {
          min-height: 44px;
          padding: 10px 11px;
          font-size: 11px;
        }

        .admin-fold-intro {
          padding-left: 11px;
          padding-right: 11px;
        }

        .admin-kmz-list-fold {
          margin-left: 14px;
          margin-right: 14px;
          margin-bottom: 16px;
        }

        .admin-kmz-list-fold > summary {
          min-height: 44px;
          padding: 10px 11px;
          font-size: 10px;
        }

        .admin-kmz-list-fold > .ak-wrap {
          padding: 9px 8px 12px;
        }

        .admin-kmz-quick {
          gap: 5px;
        }

        .admin-kmz-quick-item {
          padding: 7px 6px;
          font-size: 7.5px;
        }

        .admin-kmz-quick-item strong {
          font-size: 7.5px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function wrapExistingBox(target, options) {
    if (!target || target.closest(`details[${ENHANCED_ATTR}="${options.kind}"]`)) {
      return null;
    }

    const details = document.createElement("details");
    details.className = `admin-fold-shell ${options.className || ""}`.trim();
    details.setAttribute(ENHANCED_ATTR, options.kind);
    details.open = options.open === true;

    const summary = document.createElement("summary");
    summary.textContent = options.summary;

    target.before(details);
    details.append(summary, target);
    return details;
  }

  function enhanceAliasSections() {
    const guide = document.querySelector(".alias-review-guide");
    const guideDetails = wrapExistingBox(guide, {
      kind: "guide",
      className: "admin-fold-guide",
      summary: "📘 説明・判断基準を見る",
      open: false
    });

    if (guideDetails && guide) {
      const intro = guideDetails.previousElementSibling;
      if (
        intro?.matches?.("p.note") &&
        /Research Review Room|研究者専用/.test(intro.textContent || "")
      ) {
        intro.classList.add("admin-fold-intro");
        guideDetails.insertBefore(intro, guide);
      }
    }

    const history = document.querySelector(".alias-review-history-box");
    wrapExistingBox(history, {
      kind: "history",
      className: "admin-fold-history",
      summary: "📝 Recent Reviews",
      open: false
    });

    const candidates = document.querySelector(".alias-dictionary-candidate-box");
    wrapExistingBox(candidates, {
      kind: "dictionary",
      className: "admin-fold-dictionary",
      summary: "📚 Dictionary Candidates",
      open: false
    });
  }

  function enhanceDictionaryCandidate(item) {
    if (!item || item.hasAttribute(ENHANCED_ATTR)) return;

    const main = item.querySelector(".alias-dictionary-candidate-main");
    if (!main) return;

    item.setAttribute(ENHANCED_ATTR, "candidate");

    const detail = document.createElement("details");
    detail.className = "admin-dictionary-detail";

    const summary = document.createElement("summary");
    summary.textContent = "詳細を見る";
    detail.appendChild(summary);

    Array.from(item.children).forEach(child => {
      if (child !== main && child !== detail) {
        detail.appendChild(child);
      }
    });

    item.appendChild(detail);
  }

  function enhanceDictionaryCandidates() {
    document
      .querySelectorAll(".alias-dictionary-candidate-item")
      .forEach(enhanceDictionaryCandidate);
  }

  function findMetaItem(meta, label) {
    if (!meta) return null;

    return Array.from(meta.children).find(child => {
      const strong = child.querySelector("strong");
      return strong && strong.textContent.trim() === label;
    }) || null;
  }

  function makeQuickItem(source) {
    if (!source) return null;

    const item = document.createElement("div");
    item.className = "admin-kmz-quick-item";
    item.innerHTML = source.innerHTML;
    return item;
  }

  function enhanceKmzCard(card) {
    if (!card || card.hasAttribute(ENHANCED_ATTR)) return;

    const meta = card.querySelector(":scope > .ak-meta");
    const actions = card.querySelector(":scope > .ak-actions");
    if (!meta || !actions) return;

    card.setAttribute(ENHANCED_ATTR, "kmz-card");

    const quick = document.createElement("div");
    quick.className = "admin-kmz-quick";

    [
      findMetaItem(meta, "最終利用"),
      findMetaItem(meta, "POI"),
      findMetaItem(meta, "警告 / 評価")
    ].forEach(source => {
      const item = makeQuickItem(source);
      if (item) quick.appendChild(item);
    });

    if (quick.children.length) {
      meta.before(quick);
    }

    const details = document.createElement("details");
    details.className = "admin-kmz-detail";

    const summary = document.createElement("summary");
    summary.textContent = "端末・サイズ・保存期限などの詳細";

    meta.before(details);
    details.append(summary, meta);
  }

  function enhanceKmzList() {
    const wrap = document.querySelector("#adminKmzBrowserV2 .ak-wrap");
    if (!wrap || wrap.closest(`details[${ENHANCED_ATTR}="kmz-list"]`)) return;

    const countText =
      wrap.querySelector(":scope > .ak-head span")?.textContent?.trim() || "";

    const details = document.createElement("details");
    details.className = "admin-kmz-list-fold";
    details.setAttribute(ENHANCED_ATTR, "kmz-list");
    details.open = false;

    const summary = document.createElement("summary");
    const label = document.createElement("span");
    label.textContent = "📍 提出KMZ一覧を見る";
    summary.appendChild(label);

    if (countText) {
      const count = document.createElement("small");
      count.textContent = countText;
      summary.appendChild(count);
    }

    wrap.before(details);
    details.append(summary, wrap);
  }

  function enhanceKmzCards() {
    document
      .querySelectorAll("#adminKmzBrowserV2 .ak-card")
      .forEach(enhanceKmzCard);
  }

  function enhanceAll() {
    enhanceAliasSections();
    enhanceDictionaryCandidates();
    enhanceKmzList();
    enhanceKmzCards();
  }

  function observeAdminUi() {
    const admin = document.getElementById("admin") || document.body;
    const observer = new MutationObserver(() => {
      enhanceAll();
    });

    observer.observe(admin, {
      childList: true,
      subtree: true
    });
  }

  function setup() {
    ensureStyles();
    enhanceAll();
    observeAdminUi();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup, { once: true });
  } else {
    setup();
  }
})();
