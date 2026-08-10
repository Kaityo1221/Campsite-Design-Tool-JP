/* ======================================================
   トップダッシュボード: カテゴリ折りたたみ

   - メインフローは常時表示
   - 事前準備 / 補助ツール / その他は初期状態で閉じる
   - オープニングは大きいカードから外し、タイトル付近の小リンクへ移動
====================================================== */

(function () {
  "use strict";

  const ENHANCED = "data-dashboard-fold-enhanced";

  function ensureStyles() {
    if (document.getElementById("dashboardFoldersStyles")) return;

    const style = document.createElement("style");
    style.id = "dashboardFoldersStyles";
    style.textContent = `
      .dashboard-fold {
        margin: 12px 0;
        border: 1px solid rgba(96, 165, 250, 0.20);
        border-radius: 18px;
        background: linear-gradient(145deg, rgba(15, 23, 42, 0.88), rgba(8, 15, 30, 0.88));
        box-shadow: 0 14px 34px rgba(2, 6, 23, 0.26), inset 0 1px 0 rgba(255,255,255,0.025);
        overflow: hidden;
      }

      .dashboard-fold > summary {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        min-height: 62px;
        padding: 14px 18px;
        box-sizing: border-box;
        cursor: pointer;
        list-style: none;
        user-select: none;
        color: #e2e8f0;
      }

      .dashboard-fold > summary::-webkit-details-marker {
        display: none;
      }

      .dashboard-fold > summary::before {
        content: "";
        position: absolute;
        left: 18px;
        right: 18px;
        bottom: 0;
        height: 1px;
        opacity: 0;
        background: linear-gradient(90deg, rgba(56,189,248,.58), rgba(168,85,247,.42), transparent);
        transition: opacity .18s ease;
      }

      .dashboard-fold[open] > summary::before {
        opacity: 1;
      }

      .dashboard-fold-title {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }

      .dashboard-fold-icon {
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        flex: 0 0 auto;
        border: 1px solid rgba(96,165,250,.24);
        border-radius: 11px;
        background: rgba(30,41,59,.58);
        box-shadow: 0 5px 18px rgba(14,165,233,.10);
        font-size: 16px;
      }

      .dashboard-fold-copy {
        display: grid;
        gap: 2px;
      }

      .dashboard-fold-copy strong {
        font-size: 15px;
        line-height: 1.2;
        color: #f8fafc;
      }

      .dashboard-fold-copy small {
        color: #71839c;
        font-size: 9px;
        font-weight: 800;
      }

      .dashboard-fold-chevron {
        display: grid;
        place-items: center;
        width: 30px;
        height: 30px;
        flex: 0 0 auto;
        border-radius: 999px;
        background: rgba(56,189,248,.08);
        color: #7dd3fc;
        font-size: 18px;
        font-weight: 900;
        transition: transform .18s ease, background .18s ease;
      }

      .dashboard-fold[open] .dashboard-fold-chevron {
        transform: rotate(45deg);
        background: rgba(168,85,247,.10);
        color: #c4b5fd;
      }

      .dashboard-fold > .dashboard-section {
        margin: 0;
        border: 0;
        border-radius: 0;
        background: transparent;
        box-shadow: none;
        padding-top: 14px;
      }

      .dashboard-fold > .dashboard-section > .dashboard-section-title {
        display: none;
      }

      .dashboard-opening-mini {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        margin-top: 7px;
        padding: 3px 7px;
        border: 0;
        background: transparent;
        color: rgba(148, 163, 184, 0.68);
        font-size: 9px;
        font-weight: 800;
        letter-spacing: .03em;
        cursor: pointer;
        text-decoration: none;
      }

      .dashboard-opening-mini:hover,
      .dashboard-opening-mini:focus-visible {
        color: #cbd5e1;
      }

      .dashboard-opening-mini span {
        font-size: 10px;
      }

      @media (max-width: 680px) {
        .dashboard-fold {
          margin: 10px 0;
          border-radius: 16px;
        }

        .dashboard-fold > summary {
          min-height: 56px;
          padding: 11px 14px;
        }

        .dashboard-fold > summary::before {
          left: 14px;
          right: 14px;
        }

        .dashboard-fold-icon {
          width: 31px;
          height: 31px;
          border-radius: 10px;
          font-size: 14px;
        }

        .dashboard-fold-copy strong {
          font-size: 14px;
        }

        .dashboard-fold-copy small {
          font-size: 8px;
        }

        .dashboard-fold-chevron {
          width: 27px;
          height: 27px;
          font-size: 16px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function foldSection(selector, options) {
    const section = document.querySelector(selector);
    if (!section || section.closest(`details[${ENHANCED}]`)) return;

    const details = document.createElement("details");
    details.className = "dashboard-fold";
    details.setAttribute(ENHANCED, options.key);
    details.open = false;

    const summary = document.createElement("summary");
    summary.innerHTML = `
      <span class="dashboard-fold-title">
        <span class="dashboard-fold-icon">${options.icon}</span>
        <span class="dashboard-fold-copy">
          <strong>${options.title}</strong>
          <small>${options.subtitle}</small>
        </span>
      </span>
      <span class="dashboard-fold-chevron" aria-hidden="true">＋</span>
    `;

    section.before(details);
    details.append(summary, section);
  }

  function moveOpeningShortcut() {
    const openingButton = document.querySelector(
      ".dashboard-other .dashboard-button[onclick*='backToOpening']"
    );
    if (!openingButton) return;

    const hero = document.querySelector(".hero");
    if (!hero || hero.querySelector(".dashboard-opening-mini")) {
      openingButton.remove();
      return;
    }

    const mini = document.createElement("button");
    mini.type = "button";
    mini.className = "dashboard-opening-mini";
    mini.innerHTML = '<span>↩</span> Opening';
    mini.addEventListener("click", () => {
      if (typeof window.backToOpening === "function") {
        window.backToOpening();
      }
    });

    const lead = hero.querySelector(".lead");
    if (lead) {
      lead.insertAdjacentElement("afterend", mini);
    } else {
      hero.appendChild(mini);
    }

    openingButton.remove();
  }

  function setup() {
    ensureStyles();
    moveOpeningShortcut();

    foldSection(".dashboard-prep", {
      key: "prep",
      icon: "🧭",
      title: "事前準備",
      subtitle: "診断・使い方・導入・ガイド"
    });

    foldSection(".dashboard-utility", {
      key: "utility",
      icon: "🧰",
      title: "補助ツール",
      subtitle: "円生成・重複POI整理"
    });

    foldSection(".dashboard-other", {
      key: "other",
      icon: "⚙️",
      title: "その他",
      subtitle: "管理者向け機能"
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup, { once: true });
  } else {
    setup();
  }
})();
