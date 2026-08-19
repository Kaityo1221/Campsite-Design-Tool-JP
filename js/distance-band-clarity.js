/* ======================================================
   Distance band clarity patch 2026-08-19

   距離判定の表示を現行50m方針に合わせて明確化する。
   - 20m未満: 密集
   - 20m以上30m未満: 滞留
   - 30m以上40m未満: 軽微
   - 40m以上50m未満: 50m未満・要確認
   - 50m以上: 原則となる間隔を満たす

   「通行」は距離閾値ではなく、現地環境チェックとして扱う。
====================================================== */

(() => {
  "use strict";

  const PATCH_FLAG = "__distanceBandClarityPatched";

  function classifyDistanceBand(distance) {
    const d = Number(distance);
    if (!Number.isFinite(d)) return null;
    if (d < 20) return "密集";
    if (d < 30) return "滞留";
    if (d < 40) return "軽微";
    if (d < 50) return "要確認";
    return null;
  }

  function isReferencePair(warning) {
    if (typeof window.isExistingPoiPair === "function") {
      return window.isExistingPoiPair(warning);
    }

    const isExisting = point => {
      const layer = String(point?.originalLayer || point?.layer || "");
      return /既存/.test(layer);
    };

    return isExisting(warning?.a) && isExisting(warning?.b);
  }

  function escapeHtml(value) {
    if (typeof window.escapeDistanceHtml === "function") {
      return window.escapeDistanceHtml(value);
    }

    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getBandSetting(type) {
    const settings = {
      "密集": {
        icon: "🔴",
        color: "#ef4444",
        label: "密集（20m未満）",
        targetLabel: "⚠ 要修正",
        message: "20m未満です。近すぎるため、配置の見直しをお願いします。"
      },
      "滞留": {
        icon: "🟠",
        color: "#f97316",
        label: "滞留（20m以上30m未満）",
        targetLabel: "⚠ 要修正",
        message: "20m以上30m未満です。滞留リスクを考慮し、配置の見直しをお願いします。"
      },
      "軽微": {
        icon: "🟡",
        color: "#facc15",
        label: "軽微（30m以上40m未満）",
        targetLabel: "🟡 軽微",
        message: "30m以上40m未満です。近接しているため、配置と現地状況を確認してください。"
      },
      "要確認": {
        icon: "⚠",
        color: "#f59e0b",
        label: "50m未満・要確認（40m以上50m未満）",
        targetLabel: "⚠ 50m未満・要確認",
        message: "40m以上50m未満です。POI間隔は原則50mのため、状況により調整が必要になる場合があります。"
      }
    };

    return settings[type] || settings["要確認"];
  }

  function installClassifier() {
    const classifier = function classifyDistanceRisk50mClarity(distance) {
      return classifyDistanceBand(distance);
    };
    Object.defineProperty(classifier, PATCH_FLAG, { value: true });
    window.classifyDistanceRisk = classifier;

    window.getRiskStyle = function getRiskStyle50mClarity(type) {
      const setting = getBandSetting(type);
      return { icon: setting.icon, color: setting.color };
    };

    window.getDistanceAdvicePriority = function getDistanceAdvicePriority50mClarity(type) {
      if (type === "密集") return 4;
      if (type === "滞留") return 3;
      if (type === "軽微") return 2;
      if (type === "要確認") return 1;
      return 0;
    };

    window.getDistanceAdviceRuleText = function getDistanceAdviceRuleText50mClarity(type) {
      return getBandSetting(type).message;
    };
  }

  function installRiskAccordion() {
    const renderer = function getRiskAccordionHtml50mClarity(warnings) {
      const groups = {
        "密集": { target: [], reference: [] },
        "滞留": { target: [], reference: [] },
        "軽微": { target: [], reference: [] },
        "要確認": { target: [], reference: [] }
      };

      (warnings || []).forEach(warning => {
        const type = classifyDistanceBand(warning?.distance);
        if (!type || !groups[type]) return;

        if (isReferencePair(warning)) {
          groups[type].reference.push(warning);
        } else {
          groups[type].target.push(warning);
        }
      });

      const actionableWarnings = (warnings || []).filter(w => {
        return !isReferencePair(w) && Number(w?.distance) < 40;
      });

      const actionableHtml =
        typeof window.getDistanceActionableAdviceHtml === "function"
          ? window.getDistanceActionableAdviceHtml(actionableWarnings)
          : "";

      function renderWarningCard(warning, type, isReference) {
        const setting = getBandSetting(type);
        const label = isReference ? "ℹ 参考" : setting.targetLabel;
        const message = isReference
          ? "既存POI同士の近接です。追加POIの調整対象には含めません。"
          : setting.message;

        return `
          <div
            class="distance-band-card"
            data-distance-band="${type}"
            data-reference="${isReference ? "true" : "false"}"
            style="
              margin:8px 0;
              padding:9px 10px;
              border-radius:10px;
              background:rgba(15,23,42,0.65);
              border:1px solid rgba(148,163,184,0.25);
              border-left:4px solid ${isReference ? "#94a3b8" : setting.color};
            "
          >
            <strong style="color:${isReference ? "#94a3b8" : setting.color};">
              ${label}（${Number(warning.distance).toFixed(1)}m）
            </strong><br>
            ${escapeHtml(warning.a?.layer)}：${escapeHtml(warning.a?.name)}<br>
            × ${escapeHtml(warning.b?.layer)}：${escapeHtml(warning.b?.name)}<br>
            → ${message}
          </div>
        `;
      }

      return `
        ${actionableHtml}
        <div class="distance-warning">
          ${Object.keys(groups).map(type => {
            const setting = getBandSetting(type);
            const targetList = groups[type].target;
            const referenceList = groups[type].reference;
            const totalCount = targetList.length + referenceList.length;

            return `
              <details style="
                margin-bottom:10px;
                padding:10px 12px 9px 14px;
                border-radius:12px;
                background:rgba(15,23,42,0.45);
                border:1px solid rgba(148,163,184,0.22);
                border-left:5px solid ${setting.color};
              ">
                <summary style="
                  cursor:pointer;
                  font-weight:bold;
                  color:${setting.color};
                  font-size:15px;
                  line-height:1.45;
                ">
                  ${setting.icon} ${setting.label}（${totalCount}件）
                </summary>

                <div style="
                  margin-top:8px;
                  padding:7px 0 0 2px;
                  border-top:1px solid rgba(148,163,184,0.18);
                ">
                  <div style="margin-bottom:8px;font-size:12px;color:#cbd5e1;">
                    追加・変更対象：${targetList.length}件 / 参考：${referenceList.length}件
                  </div>

                  <details style="
                    margin-bottom:8px;
                    padding:8px 10px;
                    border-radius:10px;
                    background:rgba(15,23,42,0.38);
                    border:1px solid rgba(148,163,184,0.20);
                  ">
                    <summary style="cursor:pointer;font-weight:bold;color:${setting.color};">
                      ${setting.targetLabel}（${targetList.length}件）
                    </summary>
                    <div style="margin-top:7px;">
                      ${targetList.length === 0
                        ? '<div style="opacity:0.7;">該当なし</div>'
                        : targetList.map(w => renderWarningCard(w, type, false)).join("")}
                    </div>
                  </details>

                  <details style="
                    margin-bottom:2px;
                    padding:8px 10px;
                    border-radius:10px;
                    background:rgba(148,163,184,0.08);
                    border:1px solid rgba(148,163,184,0.18);
                  ">
                    <summary style="cursor:pointer;font-weight:bold;color:#cbd5e1;">
                      ℹ 参考：既存POI同士（${referenceList.length}件）
                    </summary>
                    <div style="margin-top:7px;">
                      ${referenceList.length === 0
                        ? '<div style="opacity:0.7;">該当なし</div>'
                        : referenceList.map(w => renderWarningCard(w, type, true)).join("")}
                    </div>
                  </details>
                </div>
              </details>
            `;
          }).join("")}
        </div>
      `;
    };

    Object.defineProperty(renderer, PATCH_FLAG, { value: true });
    window.getRiskAccordionHtml = renderer;
  }

  function getRenderedBandCounts() {
    const counts = {
      dense: 0,
      stay: 0,
      light: 0,
      near50: 0,
      reference: 0
    };

    document.querySelectorAll("#distanceResult .distance-band-card").forEach(card => {
      const isReference = card.dataset.reference === "true";
      if (isReference) {
        counts.reference += 1;
        return;
      }

      const band = card.dataset.distanceBand;
      if (band === "密集") counts.dense += 1;
      else if (band === "滞留") counts.stay += 1;
      else if (band === "軽微") counts.light += 1;
      else if (band === "要確認") counts.near50 += 1;
    });

    return counts;
  }

  function installJudgementNormalizer() {
    window.normalizeJudgementSection = function normalizeJudgementSection50mClarity(section) {
      if (!section) return;
      const card = section.querySelector(".distance-warning");
      if (!card) return;

      const counts = getRenderedBandCounts();
      const targetTotal = counts.dense + counts.stay + counts.light + counts.near50;

      let status = "50m以上";
      let icon = "✅";
      let color = "#22c55e";

      if (counts.dense + counts.stay > 0) {
        status = "要修正";
        icon = "🚨";
        color = "#ef4444";
      } else if (counts.light + counts.near50 > 0) {
        status = "50m未満あり";
        icon = "⚠";
        color = "#f59e0b";
      } else if (counts.reference > 0) {
        status = "参考近接あり";
        icon = "ℹ";
        color = "#94a3b8";
      }

      card.style.borderColor = color;
      card.dataset.distanceBandClarityNormalized = "true";
      card.innerHTML = `
        <strong style="color:${color};font-size:20px;">
          ${icon} 判定結果：${status}
        </strong><br><br>
        🔴 20m未満（密集）：${counts.dense}件<br>
        🟠 20m以上30m未満（滞留）：${counts.stay}件<br>
        🟡 30m以上40m未満（軽微）：${counts.light}件<br>
        ⚠ 40m以上50m未満（50m未満・要確認）：${counts.near50}件<br>
        参考：既存POI同士 ${counts.reference}件<br>
        追加・変更対象の50m未満合計：${targetTotal}件<br><br>
        ${targetTotal === 0
          ? "追加・変更対象の50m未満の組み合わせはありません。"
          : "追加・変更対象に関係する50m未満の組み合わせがあります。分類別チェックと地図で確認してください。"}
      `;
    };
  }

  function updateRankGuide() {
    const rankGuide = document.querySelector("#distance .rank-guide-box");
    if (!rankGuide) return;

    rankGuide.innerHTML = `
      <strong>距離判定の見方</strong><br><br>
      🔴 20m未満：密集。配置の見直しを強く推奨します。<br><br>
      🟠 20m以上30m未満：滞留。配置の見直しを推奨します。<br><br>
      🟡 30m以上40m未満：軽微。近接しているため確認します。<br><br>
      ⚠ 40m以上50m未満：50m未満・要確認。POI間隔は原則50mです。<br><br>
      ⚪ 50m以上：原則となる間隔を満たしています。<br><br>
      <span style="opacity:.85;">※「通行」は距離の閾値ではなく、狭い通路・入口・信号周辺などの現地環境を確認する項目です。</span>
    `;
  }

  function patchMapRenderer() {
    const original = window.renderSimpleDistanceMap;
    if (typeof original !== "function" || original[PATCH_FLAG]) return;

    try {
      let source = original.toString();
      const before = source;

      source = source.replace(
        `<div>\n          <span class="distance-legend-line light"></span>\n          30〜40m\n        </div>\n\n        <div>`,
        `<div>\n          <span class="distance-legend-line light"></span>\n          30〜40m（軽微）\n        </div>\n\n        <div>\n          <span class="distance-legend-line light" style="border-top-color:#f59e0b;"></span>\n          40〜50m未満（要確認）\n        </div>\n\n        <div>`
      );

      source = source.replace(
        `    let color = "#facc15";\n    let label = "軽微";\n\n    if (w.distance < 20) {\n      color = "#ef4444";\n      label = "密集";\n    } else if (w.distance < 30) {\n      color = "#f97316";\n      label = "滞留";\n    }`,
        `    let color = "#f59e0b";\n    let label = "50m未満・要確認";\n\n    if (w.distance < 20) {\n      color = "#ef4444";\n      label = "密集";\n    } else if (w.distance < 30) {\n      color = "#f97316";\n      label = "滞留";\n    } else if (w.distance < 40) {\n      color = "#facc15";\n      label = "軽微";\n    }`
      );

      if (source === before) return;

      const patched = Function(`"use strict"; return (${source});`)();
      Object.defineProperty(patched, PATCH_FLAG, { value: true });
      window.renderSimpleDistanceMap = patched;
    } catch (error) {
      console.warn("[distance-band-clarity] 地図表示の更新に失敗しました。", error);
    }
  }

  function normalizeRenderedCopy() {
    const result = document.getElementById("distanceResult");
    if (!result || !result.children.length) return;

    const counts = getRenderedBandCounts();

    result.querySelectorAll(".distance-warning").forEach(card => {
      if (!/30〜50m参考：\d+件/.test(card.innerHTML)) return;
      card.innerHTML = card.innerHTML.replace(
        /30〜50m参考：\d+件/g,
        `30〜40m（軽微）：${counts.light}件<br>40〜50m未満（要確認）：${counts.near50}件`
      );
    });
  }

  function refreshRenderedResult() {
    updateRankGuide();
    normalizeRenderedCopy();

    const result = document.getElementById("distanceResult");
    if (!result) return;

    const sections = Array.from(result.querySelectorAll(".distance-result-section"));
    const judgementSection = sections.find(section => {
      const heading = section.querySelector(".distance-result-heading");
      return (heading?.textContent || "").includes("判定結果");
    });

    if (judgementSection) {
      window.normalizeJudgementSection?.(judgementSection);
    }
  }

  function installObserver() {
    const result = document.getElementById("distanceResult");
    if (!result || result.dataset.distanceBandClarityObserver === "true") return;

    result.dataset.distanceBandClarityObserver = "true";
    const observer = new MutationObserver(() => {
      queueMicrotask(refreshRenderedResult);
    });
    observer.observe(result, { childList: true, subtree: true });
  }

  function applyAll() {
    if (!document.getElementById("distance")) return;
    installClassifier();
    installRiskAccordion();
    installJudgementNormalizer();
    patchMapRenderer();
    updateRankGuide();
    installObserver();
    refreshRenderedResult();
  }

  applyAll();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyAll, { once: true });
  }

  [0, 250, 800, 1600, 3000].forEach(delay => {
    setTimeout(applyAll, delay);
  });
})();
