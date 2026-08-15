/* =========================
   UI大改修 03 / 05 / 06
   距離チェック入口と結果表示を整理する。
   距離判定・スコア・地図・送信ロジックには触れない。
========================= */

function ensureDistanceEntryStyles() {
  if (document.getElementById("distanceEntryStyles")) return;

  const style = document.createElement("style");
  style.id = "distanceEntryStyles";
  style.textContent = `
    #distance .distance-entry-lead{margin:0 0 16px;color:#cbd5e1;font-size:14px;line-height:1.75}
    #distance .distance-file-step,#distance .distance-run-step{padding:18px;background:rgba(15,23,42,.72);scroll-margin-top:16px}
    #distance .distance-file-step{border-color:rgba(56,189,248,.42);background:radial-gradient(circle at top right,rgba(56,189,248,.10),transparent 38%),rgba(15,23,42,.72)}
    #distance .distance-run-step{margin-top:14px;border-color:rgba(168,85,247,.42);background:radial-gradient(circle at top right,rgba(168,85,247,.11),transparent 38%),rgba(15,23,42,.72)}
    #distance .distance-file-step h3,#distance .distance-run-step h3{margin:4px 0 8px;color:#f8fafc;font-size:19px;line-height:1.45}
    #distance .distance-file-guide{margin:0 0 14px;color:#cbd5e1;font-size:13px;line-height:1.7}
    #distance .distance-file-slot input[type="file"]{width:100%;box-sizing:border-box}
    #distance .distance-file-meta{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px 12px;margin-top:10px;color:#94a3b8;font-size:12px;line-height:1.6}
    #distance .distance-file-meta a{color:#7dd3fc;font-weight:700}
    #distance .distance-file-meta a small{display:block;margin-top:2px;color:#bae6fd;font-size:11px;font-weight:600}
    #distance .distance-layer-warning{margin-top:14px;padding:12px 14px;border:1px solid rgba(245,158,11,.4);border-radius:12px;background:rgba(245,158,11,.1);color:#fde68a;font-size:13px;line-height:1.7}
    #distance .distance-layer-warning strong{display:block;margin-bottom:3px;color:#fef3c7}
    #distance .distance-entry-details,#distance .distance-rank-details,#distance .distance-result-details{margin-top:12px;overflow:hidden;border:1px solid rgba(148,163,184,.26);border-radius:12px;background:rgba(15,23,42,.52)}
    #distance .distance-entry-details summary,#distance .distance-rank-details summary,#distance .distance-result-details summary{padding:12px 14px;color:#bae6fd;font-size:13px;font-weight:800;cursor:pointer;list-style-position:inside}
    #distance .distance-entry-details-body,#distance .distance-result-details-body{padding:0 14px 14px;color:#cbd5e1;font-size:12px;line-height:1.75}
    #distance .distance-summary-slot,#distance .distance-layer-results{margin-top:14px}
    #distance .distance-layer-results:empty{display:none}
    #distance .distance-site-observation-step{margin-top:14px}
    #distance .distance-run-step>.generate{width:100%;box-sizing:border-box;margin-top:8px}
    #distance .distance-rank-details .rank-guide-box{margin:0;border:0;border-top:1px solid rgba(148,163,184,.18);border-radius:0}

    #distanceResult.distance-result-ready{margin-top:18px}
    #distanceResult .distance-result-intro{margin:0 0 14px;padding:14px 16px;border:1px solid rgba(56,189,248,.35);border-radius:14px;background:rgba(14,165,233,.08);color:#dbeafe;font-size:13px;line-height:1.7}
    #distanceResult .distance-result-section{margin:0 0 14px}
    #distanceResult .distance-result-heading{margin:0 0 8px;padding:9px 12px;border-left:5px solid #38bdf8;border-radius:10px;background:rgba(15,23,42,.58);color:#e5e7eb;font-size:15px;font-weight:800;letter-spacing:.02em}
    #distanceResult .distance-result-details{margin:0 0 12px}
    #distanceResult .distance-result-details summary{color:#cbd5e1}
    #distanceResult .distance-result-details[data-attention="true"]{border-color:rgba(245,158,11,.42);background:rgba(245,158,11,.07)}
    #distanceResult .distance-result-details[data-attention="true"] summary{color:#fde68a}
    #distanceResult .distance-result-primary{display:flex;flex-direction:column}
    #distanceResult .distance-result-advice{margin:0 0 14px!important}
    #distanceResult .distance-result-secondary{margin:6px 0 14px}
    #distanceResult .distance-result-map{margin-top:4px}
    #distanceResult .distance-result-details-body .distance-result-duplicate-title{display:none!important}
    #distanceResult .distance-classification-body>.distance-warning{margin-top:0;padding:10px 12px}
    #distanceResult .distance-classification-note{margin:8px 0 0;padding:7px 10px;border-radius:9px;background:rgba(148,163,184,.08);border:1px solid rgba(148,163,184,.16);color:#cbd5e1;font-size:12px;line-height:1.45}
    #distance .distance-checklist-guide{margin-top:16px;padding:16px;border:1px solid rgba(34,197,94,.35);border-radius:14px;background:rgba(34,197,94,.08);text-align:center;color:#d1fae5}
    #distance .distance-checklist-guide p{margin:0 0 12px;font-size:13px;line-height:1.7}
    #distance .distance-checklist-guide button{width:100%;padding:11px 14px;border:1px solid rgba(34,197,94,.45);border-radius:10px;background:rgba(34,197,94,.16);color:#dcfce7;font-weight:800;cursor:pointer}

    @media(max-width:520px){
      #distance .panel>h2{font-size:22px}
      #distance .distance-file-step,#distance .distance-run-step{padding:15px}
      #distance .distance-file-meta{align-items:flex-start;flex-direction:column}
      #distanceResult .distance-result-intro{padding:12px 13px}
      #distanceResult .distance-result-details-body{padding:0 12px 12px}
      #distanceResult .distance-classification-body>.distance-warning{padding:8px 10px}
    }
  `;
  document.head.appendChild(style);
}

function setupDistanceEntryUi() {
  const section = document.getElementById("distance");
  if (!section || section.dataset.entryUiReady === "true") return;

  const panel = section.querySelector(".panel");
  const fileInput = document.getElementById("distanceFile");
  const poiSummary = document.getElementById("distancePoiSummary");
  const layerList = document.getElementById("distanceLayerList");
  const oldLayerStep = document.getElementById("distanceCheckStep");
  const runButton = section.querySelector('button.generate[onclick*="runDistanceCheck"]');
  if (!panel || !fileInput || !poiSummary || !layerList || !oldLayerStep || !runButton) return;

  ensureDistanceEntryStyles();

  const fileStep = fileInput.closest(".step");
  const observationStep = oldLayerStep.nextElementSibling;
  const executionStep = runButton.closest(".step");
  const title = panel.querySelector(":scope > h2");
  const lead = title?.nextElementSibling;
  if (!fileStep || !executionStep) return;

  section.dataset.entryUiReady = "true";
  if (title) title.textContent = "完成KMZを距離チェック";
  if (lead?.matches("p")) {
    lead.className = "distance-entry-lead";
    lead.innerHTML = "Google My Mapsから書き出した完成KMZを読み込み、<br>追加POI・活動範囲・距離条件を提出前に確認します。";
  }

  fileStep.classList.add("distance-file-step");
  fileStep.innerHTML = `
    <div class="step-no">STEP 1</div>
    <h3>完成KMZを選択</h3>
    <p class="distance-file-guide">Google My Mapsから書き出した、提出直前の完成KMZを選択してください。</p>
    <div class="distance-file-slot"></div>
    <div class="distance-file-meta">
      <span>KMZ / KML / ZIPに対応</span>
      <a href="docs/campsite-guide.pdf#page=12" target="_blank" rel="noopener">書き出し方法を確認<br><small>マニュアル12P「5-5」を参照</small></a>
    </div>
    <div class="distance-layer-warning"><strong>レイヤー名の確認</strong>「既存」または「追加」を含めてください。<br>例：既存ポケストップ、追加ジム</div>
    <details class="distance-entry-details">
      <summary>判定対象とレイヤー名の詳細を見る</summary>
      <div class="distance-entry-details-body">対象POIは、ポケストップ・ジム・パワースポットです。<br>例：既存ポケストップ、既存ジム、追加ポケストップ、追加パワースポット<br>30m・40m円などの補助レイヤーは自動的に除外されます。<br><br>iPhoneで <strong>.kmz.zip</strong> として保存された場合は、ファイルアプリの「名称変更」で末尾の <strong>.zip</strong> を削除してください。</div>
    </details>
    <div class="distance-summary-slot"></div>
    <div class="distance-layer-results"></div>
  `;

  fileStep.querySelector(".distance-file-slot").appendChild(fileInput);
  fileStep.querySelector(".distance-summary-slot").appendChild(poiSummary);
  fileStep.querySelector(".distance-layer-results").appendChild(layerList);
  oldLayerStep.remove();

  if (observationStep?.classList.contains("step")) observationStep.classList.add("distance-site-observation-step");
  executionStep.id = "distanceCheckStep";
  executionStep.classList.add("distance-run-step");
  const executionStepNumber = executionStep.querySelector(".step-no");
  if (executionStepNumber) executionStepNumber.textContent = "STEP 2";

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

  if (observationStep?.classList.contains("step") && executionStep.previousElementSibling !== observationStep) {
    observationStep.after(executionStep);
  }
}

function isDistanceSectionHeader(node) {
  if (!(node instanceof HTMLElement) || node.tagName !== "DIV") return false;
  return (node.getAttribute("style") || "").includes("border-left:5px solid #38bdf8");
}

function getDistanceSectionTitle(node) {
  return (node.textContent || "").trim().split("\n")[0].trim();
}

function markDuplicateResultTitle(body, title) {
  const candidates = Array.from(body.querySelectorAll("strong,h3,h4,div"));
  const duplicate = candidates.find(element => {
    const text = (element.textContent || "").trim();
    if (text !== title) return false;
    return !element.querySelector("div,section,details");
  });
  if (duplicate) duplicate.classList.add("distance-result-duplicate-title");
}

function isDistanceAdviceNode(node) {
  return node instanceof HTMLElement &&
    (node.textContent || "").includes("🧭 次に確認する場所");
}

function compactClassificationSection(body) {
  if (!body) return;
  body.classList.add("distance-classification-body");

  const accordion = body.querySelector(":scope > .distance-warning");
  if (!accordion) return;

  const fullText = body.textContent || "";
  const referenceCount = Number(fullText.match(/参考\s*[:：]\s*(\d+)件/)?.[1] || 0);

  let node = accordion.nextSibling;
  while (node) {
    const next = node.nextSibling;
    node.remove();
    node = next;
  }

  const note = document.createElement("div");
  note.className = "distance-classification-note";
  note.textContent = `ℹ 参考：既存POI同士 ${referenceCount}件`;
  body.appendChild(note);
}

function normalizeJudgementSection(section) {
  if (!section) return;
  const card = section.querySelector(".distance-warning");
  if (!card) return;

  const text = card.textContent || "";
  const dense = Number(text.match(/20m未満（密集）\s*：\s*(\d+)件/)?.[1] || 0);
  const stay = Number(text.match(/20〜30m（滞留）\s*：\s*(\d+)件/)?.[1] || 0);
  const near50 = Number(
    text.match(/30〜50m(?:（参考距離）)?\s*：\s*(\d+)件/)?.[1] ||
    text.match(/30m〜50m未満(?:（要確認）)?\s*：\s*(\d+)件/)?.[1] ||
    text.match(/30〜40m（軽微）\s*：\s*(\d+)件/)?.[1] ||
    0
  );
  const actionableTotal = dense + stay + near50;

  let status = "問題なし";
  let icon = "✅";
  let color = "#22c55e";

  if (dense + stay > 0) {
    status = "要修正";
    icon = "⚠";
    color = "#ef4444";
  } else if (near50 > 0) {
    status = "50m未満あり";
    icon = "△";
    color = "#f59e0b";
  }

  card.style.borderColor = color;
  card.innerHTML = `
    <strong style="color:${color};font-size:20px;">
      ${icon} 判定結果：${status}
    </strong><br><br>
    20m未満（密集）：${dense}件<br>
    20〜30m（滞留）：${stay}件<br>
    30〜50m未満（要確認）：${near50}件<br>
    50m未満合計：${actionableTotal}件<br><br>
    ${actionableTotal === 0
      ? "追加・変更対象の50m未満の組み合わせはありません。"
      : "追加・変更対象に関係する50m未満の組み合わせがあります。詳細を開き、対象POIと地図を確認してください。"}
  `;
}

function enhanceDistanceResultUi() {
  const result = document.getElementById("distanceResult");
  if (!result || result.dataset.resultUiReady === "true" || !result.children.length) return;

  const originalNodes = Array.from(result.childNodes);
  const groups = [];
  let current = null;

  originalNodes.forEach(node => {
    if (isDistanceSectionHeader(node)) {
      current = { title:getDistanceSectionTitle(node), nodes:[] };
      groups.push(current);
      node.remove();
      return;
    }
    if (current) current.nodes.push(node);
  });

  if (!groups.length) return;
  result.dataset.resultUiReady = "true";
  result.classList.add("distance-result-ready");
  result.replaceChildren();

  const intro = document.createElement("div");
  intro.className = "distance-result-intro";
  intro.innerHTML = "<strong>まず判定結果を確認してください。</strong><br>調整が必要な場合は詳細を開き、対象POIと地図を確認します。";

  const primary = document.createElement("div");
  primary.className = "distance-result-primary";
  const secondary = document.createElement("div");
  secondary.className = "distance-result-secondary";
  let mapSection = null;
  let adviceNode = null;

  const primaryTitles = ["判定結果", "拠点充実度", "距離チェックマップ"];
  const attentionTitles = ["重複POIチェック", "追加・変更対象", "分類別チェック"];

  groups.forEach(group => {
    if (primaryTitles.includes(group.title)) {
      const section = document.createElement("section");
      section.className = "distance-result-section";
      section.dataset.resultTitle = group.title;
      const heading = document.createElement("div");
      heading.className = "distance-result-heading";
      heading.textContent = group.title;
      section.appendChild(heading);
      group.nodes.forEach(node => section.appendChild(node));

      if (group.title === "判定結果") normalizeJudgementSection(section);

      if (group.title === "距離チェックマップ") {
        section.classList.add("distance-result-map");
        mapSection = section;
      } else {
        primary.appendChild(section);
      }
      return;
    }

    if (group.title === "分類別チェック") {
      const adviceIndex = group.nodes.findIndex(isDistanceAdviceNode);
      if (adviceIndex >= 0) {
        adviceNode = group.nodes.splice(adviceIndex, 1)[0];
      }
    }

    const details = document.createElement("details");
    details.className = "distance-result-details";
    details.dataset.attention = attentionTitles.some(title => group.title.startsWith(title)) ? "true" : "false";
    const summary = document.createElement("summary");
    summary.textContent = group.title;
    const body = document.createElement("div");
    body.className = "distance-result-details-body";
    group.nodes.forEach(node => body.appendChild(node));
    markDuplicateResultTitle(body, group.title);
    if (group.title === "分類別チェック") compactClassificationSection(body);
    details.append(summary, body);
    secondary.appendChild(details);
  });

  ["判定結果", "拠点充実度"].forEach(title => {
    const section = primary.querySelector(`[data-result-title="${title}"]`);
    if (section) primary.appendChild(section);
  });

  const judgementSection = primary.querySelector('[data-result-title="判定結果"]');
  if (adviceNode instanceof HTMLElement && judgementSection) {
    adviceNode.classList.add("distance-result-advice");
    judgementSection.insertAdjacentElement("afterend", adviceNode);
  }

  result.append(intro, primary, secondary);
  if (mapSection) result.appendChild(mapSection);
}

function ensureDistanceChecklistGuide() {
  const result = document.getElementById("distanceResult");
  const distanceMap = document.getElementById("distanceMap");
  const executionStep = document.getElementById("distanceCheckStep");
  if (!result || !distanceMap || !executionStep || !result.children.length) return;

  executionStep.querySelector(".distance-checklist-guide")?.remove();

  const guide = document.createElement("div");
  guide.className = "distance-checklist-guide";
  guide.innerHTML = `
    <p><strong>距離チェックが終わったら、提出前チェックで最終確認しましょう。</strong></p>
    <button type="button" data-go-pre-submit>提出前チェックリストへ進む</button>
  `;

  guide.querySelector("[data-go-pre-submit]")?.addEventListener("click", () => {
    const button = document.querySelector('.tab-button[onclick*="check"]');
    if (typeof window.openTab === "function") {
      window.openTab("check", button || null);
    }
    if (typeof window.renderPreSubmitCheck === "function") {
      window.renderPreSubmitCheck();
    }
  });

  distanceMap.insertAdjacentElement("afterend", guide);
}

function wrapDistanceCheckForResultUi() {
  if (window.__distanceResultUiWrapped || typeof window.runDistanceCheck !== "function") return;
  const originalRunDistanceCheck = window.runDistanceCheck;
  window.runDistanceCheck = async function(...args) {
    const result = document.getElementById("distanceResult");
    if (result) {
      delete result.dataset.resultUiReady;
      result.classList.remove("distance-result-ready");
    }
    const value = await originalRunDistanceCheck.apply(this, args);
    enhanceDistanceResultUi();
    ensureDistanceChecklistGuide();
    return value;
  };
  window.__distanceResultUiWrapped = true;
}

document.addEventListener("DOMContentLoaded", () => {
  setupDistanceEntryUi();
  wrapDistanceCheckForResultUi();
});