/* =========================
   UI大改修 03：距離チェック入口の簡素化
   距離判定ロジックには触れず、画面構成だけを整理する。
========================= */

function ensureDistanceEntryStyles() {
  if (document.getElementById("distanceEntryStyles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "distanceEntryStyles";
  style.textContent = `
    #distance .distance-entry-lead {
      margin: 0 0 16px;
      color: #cbd5e1;
      font-size: 14px;
      line-height: 1.75;
    }

    #distance .distance-file-step {
      padding: 18px;
      border-color: rgba(56, 189, 248, 0.42);
      background:
        radial-gradient(
          circle at top right,
          rgba(56, 189, 248, 0.1),
          transparent 38%
        ),
        rgba(15, 23, 42, 0.72);
    }

    #distance .distance-file-step h3,
    #distance .distance-run-step h3 {
      margin: 4px 0 8px;
      color: #f8fafc;
      font-size: 19px;
      line-height: 1.45;
    }

    #distance .distance-file-guide {
      margin: 0 0 14px;
      color: #cbd5e1;
      font-size: 13px;
      line-height: 1.7;
    }

    #distance .distance-file-slot input[type="file"] {
      width: 100%;
      box-sizing: border-box;
    }

    #distance .distance-file-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px 12px;
      margin-top: 10px;
      color: #94a3b8;
      font-size: 12px;
      line-height: 1.6;
    }

    #distance .distance-file-meta a {
      color: #7dd3fc;
      font-weight: 700;
    }

    #distance .distance-file-meta a small {
      display: block;
      margin-top: 2px;
      color: #bae6fd;
      font-size: 11px;
      font-weight: 600;
    }

    #distance .distance-layer-warning {
      margin-top: 14px;
      padding: 12px 14px;
      border: 1px solid rgba(245, 158, 11, 0.4);
      border-radius: 12px;
      background: rgba(245, 158, 11, 0.1);
      color: #fde68a;
      font-size: 13px;
      line-height: 1.7;
    }

    #distance .distance-layer-warning strong {
      display: block;
      margin-bottom: 3px;
      color: #fef3c7;
    }

    #distance .distance-entry-details {
      margin-top: 12px;
      overflow: hidden;
      border: 1px solid rgba(148, 163, 184, 0.26);
      border-radius: 12px;
      background: rgba(15, 23, 42, 0.52);
    }

    #distance .distance-entry-details summary {
      padding: 11px 13px;
      color: #bae6fd;
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;
    }

    #distance .distance-entry-details-body {
      padding: 0 13px 13px;
      color: #cbd5e1;
      font-size: 12px;
      line-height: 1.75;
    }

    #distance .distance-summary-slot,
    #distance .distance-layer-results {
      margin-top: 14px;
    }

    #distance .distance-layer-results:empty {
      display: none;
    }

    #distance .distance-site-observation-step {
      margin-top: 14px;
    }

    #distance .distance-run-step {
      margin-top: 14px;
      padding: 18px;
      border-color: rgba(168, 85, 247, 0.42);
      background:
        radial-gradient(
          circle at top right,
          rgba(168, 85, 247, 0.11),
          transparent 38%
        ),
        rgba(15, 23, 42, 0.72);
      scroll-margin-top: 16px;
    }

    #distance .distance-run-step > .generate {
      width: 100%;
      box-sizing: border-box;
      margin-top: 8px;
    }

    #distance .distance-rank-details {
      margin-top: 14px;
      overflow: hidden;
      border: 1px solid rgba(148, 163, 184, 0.24);
      border-radius: 12px;
      background: rgba(2, 6, 23, 0.42);
    }

    #distance .distance-rank-details summary {
      padding: 11px 13px;
      color: #cbd5e1;
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;
    }

    #distance .distance-rank-details .rank-guide-box {
      margin: 0;
      border: 0;
      border-top: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 0;
    }

    @media (max-width: 520px) {
      #distance .panel > h2 {
        font-size: 22px;
      }

      #distance .distance-file-step,
      #distance .distance-run-step {
        padding: 15px;
      }

      #distance .distance-file-meta {
        align-items: flex-start;
        flex-direction: column;
      }
    }
  `;

  document.head.appendChild(style);
}

function setupDistanceEntryUi() {
  const section = document.getElementById("distance");

  if (!section || section.dataset.entryUiReady === "true") {
    return;
  }

  const panel = section.querySelector(".panel");
  const fileInput = document.getElementById("distanceFile");
  const poiSummary = document.getElementById("distancePoiSummary");
  const layerList = document.getElementById("distanceLayerList");
  const oldLayerStep = document.getElementById("distanceCheckStep");
  const runButton = section.querySelector(
    'button.generate[onclick*="runDistanceCheck"]'
  );

  if (
    !panel ||
    !fileInput ||
    !poiSummary ||
    !layerList ||
    !oldLayerStep ||
    !runButton
  ) {
    return;
  }

  ensureDistanceEntryStyles();

  const fileStep = fileInput.closest(".step");
  const observationStep = oldLayerStep.nextElementSibling;
  const executionStep = runButton.closest(".step");
  const title = panel.querySelector(":scope > h2");
  const lead = title?.nextElementSibling;

  if (!fileStep || !executionStep) {
    return;
  }

  section.dataset.entryUiReady = "true";

  if (title) {
    title.textContent = "完成KMZを距離チェック";
  }

  if (lead && lead.matches("p")) {
    lead.className = "distance-entry-lead";
    lead.innerHTML =
      "Google My Mapsから書き出した完成KMZを読み込み、<br>" +
      "追加POI・活動範囲・距離条件を提出前に確認します。";
  }

  fileStep.classList.add("distance-file-step");
  fileStep.innerHTML = `
    <div class="step-no">STEP 1</div>
    <h3>完成KMZを選択</h3>
    <p class="distance-file-guide">
      Google My Mapsから書き出した、提出直前の完成KMZを選択してください。
    </p>

    <div class="distance-file-slot"></div>

    <div class="distance-file-meta">
      <span>KMZ / KML / ZIPに対応</span>
      <a
        href="docs/campsite-guide.pdf#page=12"
        target="_blank"
        rel="noopener"
      >
        書き出し方法を確認<br>
        <small>マニュアル12P「5-5」を参照</small>
      </a>
    </div>

    <div class="distance-layer-warning">
      <strong>レイヤー名の確認</strong>
      「既存」または「追加」を含めてください。<br>
      例：既存ポケストップ、追加ジム
    </div>

    <details class="distance-entry-details">
      <summary>判定対象とレイヤー名の詳細を見る</summary>
      <div class="distance-entry-details-body">
        対象POIは、ポケストップ・ジム・パワースポットです。<br>
        例：既存ポケストップ、既存ジム、追加ポケストップ、追加パワースポット<br>
        30m・40m円などの補助レイヤーは自動的に除外されます。<br><br>
        iPhoneで <strong>.kmz.zip</strong> として保存された場合は、
        ファイルアプリの「名称変更」で末尾の <strong>.zip</strong> を削除してください。
      </div>
    </details>

    <div class="distance-summary-slot"></div>
    <div class="distance-layer-results"></div>
  `;

  fileStep
    .querySelector(".distance-file-slot")
    .appendChild(fileInput);

  fileStep
    .querySelector(".distance-summary-slot")
    .appendChild(poiSummary);

  fileStep
    .querySelector(".distance-layer-results")
    .appendChild(layerList);

  oldLayerStep.remove();

  if (observationStep?.classList.contains("step")) {
    observationStep.classList.add(
      "distance-site-observation-step"
    );
  }

  executionStep.id = "distanceCheckStep";
  executionStep.classList.add("distance-run-step");

  const executionStepNumber = executionStep.querySelector(".step-no");

  if (executionStepNumber) {
    executionStepNumber.textContent = "STEP 2";
  }

  if (!executionStep.querySelector(":scope > h3")) {
    const heading = document.createElement("h3");
    heading.textContent = "距離チェックを実行";
    runButton.before(heading);
  }

  const rankGuide = executionStep.querySelector(".rank-guide-box");

  if (rankGuide) {
    const rankDetails = document.createElement("details");
    rankDetails.className = "distance-rank-details";
    rankDetails.innerHTML = "<summary>距離判定の見方を確認</summary>";
    rankGuide.replaceWith(rankDetails);
    rankDetails.appendChild(rankGuide);
  }

  if (
    observationStep?.classList.contains("step") &&
    executionStep.previousElementSibling !== observationStep
  ) {
    observationStep.after(executionStep);
  }
}

document.addEventListener("DOMContentLoaded", setupDistanceEntryUi);
