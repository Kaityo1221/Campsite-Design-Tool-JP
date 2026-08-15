/* ======================================================
   トップダッシュボード: カテゴリ折りたたみ

   - メインフローは常時表示
   - 事前準備は初期状態で開く
   - 補助ツール / その他は初期状態で閉じる
   - オープニングは大きいカードから外し、タイトル付近の小リンクへ移動
   - 事前準備の「マニュアル」はPDF入口として最優先表示
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

      .dashboard-fold > summary::-webkit-details-marker { display: none; }

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

      .dashboard-fold[open] > summary::before { opacity: 1; }

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

      .dashboard-fold-copy { display: grid; gap: 2px; }
      .dashboard-fold-copy strong { font-size: 15px; line-height: 1.2; color: #f8fafc; }
      .dashboard-fold-copy small { color: #71839c; font-size: 9px; font-weight: 800; }

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

      .dashboard-fold > .dashboard-section > .dashboard-section-title { display: none; }

      .dashboard-manual-feature {
        position: relative;
        grid-column: 1 / -1;
        width: 100%;
        min-height: 86px;
        order: -10;
        padding: 16px 18px !important;
        border: 1px solid rgba(125,211,252,.78) !important;
        border-radius: 16px !important;
        background: linear-gradient(135deg, rgba(14,165,233,.18), rgba(79,70,229,.20)) !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.10), 0 10px 24px rgba(14,165,233,.15) !important;
        text-align: left;
      }

      .dashboard-manual-feature::after {
        content: "まずここから";
        position: absolute;
        top: 10px;
        right: 12px;
        padding: 4px 8px;
        border-radius: 999px;
        background: rgba(125,211,252,.16);
        color: #bae6fd;
        font-size: 9px;
        font-weight: 900;
        letter-spacing: .04em;
      }

      .dashboard-manual-feature .dashboard-icon {
        width: 42px;
        height: 42px;
        flex: 0 0 auto;
      }

      .dashboard-manual-feature .dashboard-copy strong {
        font-size: 17px;
        color: #f8fafc;
      }

      .dashboard-manual-feature .dashboard-copy small {
        margin-top: 4px;
        font-size: 10px;
        line-height: 1.45;
        color: #bae6fd;
      }

      .dashboard-opening-mini {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        min-height: 40px;
        margin-top: 12px;
        padding: 9px 16px;
        border: 1px solid rgba(125, 211, 252, 0.62);
        border-radius: 999px;
        background: linear-gradient(135deg, rgba(37, 99, 235, 0.30), rgba(124, 58, 237, 0.28));
        color: #f8fafc;
        font-size: 13px;
        font-weight: 900;
        letter-spacing: .02em;
        line-height: 1;
        cursor: pointer;
        text-decoration: none;
        text-shadow: 0 0 10px rgba(255,255,255,.20);
        box-shadow: inset 0 1px 0 rgba(255,255,255,.13), 0 8px 22px rgba(37,99,235,.20), 0 0 18px rgba(125,211,252,.16);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        -webkit-tap-highlight-color: transparent;
        transition: transform .16s ease, border-color .16s ease, background .16s ease, box-shadow .16s ease;
      }

      .dashboard-opening-mini:hover,
      .dashboard-opening-mini:focus-visible {
        color: #ffffff;
        border-color: rgba(186, 230, 253, 0.92);
        background: linear-gradient(135deg, rgba(37, 99, 235, 0.44), rgba(124, 58, 237, 0.40));
        box-shadow: inset 0 1px 0 rgba(255,255,255,.18), 0 10px 26px rgba(37,99,235,.26), 0 0 24px rgba(125,211,252,.28);
      }

      .dashboard-opening-mini:active { transform: scale(.97); }
      .dashboard-opening-mini span { color: #bae6fd; font-size: 12px; line-height: 1; filter: drop-shadow(0 0 5px rgba(125,211,252,.55)); }

      @media (max-width: 680px) {
        .dashboard-fold { margin: 10px 0; border-radius: 16px; }
        .dashboard-fold > summary { min-height: 56px; padding: 11px 14px; }
        .dashboard-fold > summary::before { left: 14px; right: 14px; }
        .dashboard-fold-icon { width: 31px; height: 31px; border-radius: 10px; font-size: 14px; }
        .dashboard-fold-copy strong { font-size: 14px; }
        .dashboard-fold-copy small { font-size: 8px; }
        .dashboard-fold-chevron { width: 27px; height: 27px; font-size: 16px; }
        .dashboard-opening-mini { min-height: 38px; margin-top: 11px; padding: 8px 14px; font-size: 12px; }

        .dashboard-manual-feature {
          min-height: 82px;
          padding: 14px 12px !important;
        }

        .dashboard-manual-feature::after {
          top: 8px;
          right: 9px;
          font-size: 8px;
        }

        .dashboard-manual-feature .dashboard-copy strong { font-size: 16px; }
        .dashboard-manual-feature .dashboard-copy small { max-width: 72%; font-size: 9px; }
      }
    `;

    document.head.appendChild(style);
  }

  function promoteManualEntry() {
    const manualButton = document.querySelector(
      ".dashboard-prep .dashboard-button[onclick*=\"openTab('howto'\"]"
    );
    if (!manualButton) return;

    manualButton.classList.add("dashboard-manual-feature");
    manualButton.setAttribute("aria-label", "マニュアルを読む");
    manualButton.onclick = null;
    manualButton.removeAttribute("onclick");
    manualButton.addEventListener("click", () => {
      window.open("docs/campsite-guide.pdf", "_blank", "noopener,noreferrer");
    });

    const title = manualButton.querySelector(".dashboard-copy strong");
    const subtitle = manualButton.querySelector(".dashboard-copy small");

    if (title) title.textContent = "マニュアルを読む";
    if (subtitle) subtitle.textContent = "キャンプサイトの作り方 Ver3.5 をPDFで確認";
  }

  function foldSection(selector, options) {
    const section = document.querySelector(selector);
    if (!section || section.closest(`details[${ENHANCED}]`)) return;

    const details = document.createElement("details");
    details.className = "dashboard-fold";
    details.setAttribute(ENHANCED, options.key);
    details.open = options.open === true;

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
    mini.innerHTML = '<span aria-hidden="true">▶</span> オープニングを見る';
    mini.setAttribute("aria-label", "オープニングを見る");
    mini.addEventListener("click", () => {
      if (typeof window.backToOpening === "function") {
        window.backToOpening();
      }
    });

    const lead = hero.querySelector(".lead");
    if (lead) lead.insertAdjacentElement("afterend", mini);
    else hero.appendChild(mini);

    openingButton.remove();
  }

  function updateDistanceRouteCopy() {
    const distanceCard = document.querySelector(
      ".dashboard-route .route-card[onclick*=\"openTab('distance'\"]"
    );
    if (!distanceCard) return;

    const subtitle = distanceCard.querySelector("small");
    if (subtitle) subtitle.textContent = "POIの間隔を確認";
  }

  function setup() {
    ensureStyles();
    moveOpeningShortcut();
    promoteManualEntry();
    updateDistanceRouteCopy();

    foldSection(".dashboard-prep", {
      key: "prep",
      icon: "🧭",
      title: "事前準備",
      subtitle: "まずマニュアルを確認・導入・設計ガイド",
      open: true
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

(function loadPostCompletionHub() {
  if (document.querySelector('script[data-post-completion-hub]')) return;
  const script = document.createElement('script');
  script.src = 'js/post-completion-hub.js?v=2';
  script.setAttribute('data-post-completion-hub', '1');
  document.head.appendChild(script);
})();