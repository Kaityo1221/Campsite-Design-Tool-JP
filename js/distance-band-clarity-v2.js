/* Distance-check band clarity: 20 / 30 / 40 / 50m. */
(() => {
  "use strict";

  const FLAG = "__distanceBandClarityV2";
  const DISCLAIMER = "※この表示はキャンプサイト設計を補助するための参考情報です。審査・承認の可否を示すものではありません。";
  let latestPairStats = {
    affectedTargetPoiCount: 0,
    totalTargetPoiCount: 0
  };

  const bandFor = distance => {
    const d = Number(distance);
    if (!Number.isFinite(d)) return null;
    if (d < 20) return "密集";
    if (d < 30) return "滞留";
    if (d < 40) return "軽微";
    if (d < 50) return "要確認";
    return null;
  };

  const settings = {
    "密集": {
      icon: "🔴",
      color: "#ef4444",
      label: "密集の目安（20m未満）",
      action: "🔴 距離がかなり近い",
      message: "20m未満です。イベント時の密集リスクを考えるための参考情報です。"
    },
    "滞留": {
      icon: "🟠",
      color: "#f97316",
      label: "滞留の目安（20m以上30m未満）",
      action: "🟠 距離が近い",
      message: "20m以上30m未満です。イベント時の滞留リスクを考えるための参考情報です。"
    },
    "軽微": {
      icon: "🟡",
      color: "#facc15",
      label: "近接の目安（30m以上40m未満）",
      action: "🟡 近接",
      message: "30m以上40m未満です。配置や周辺状況を見るための参考情報です。"
    },
    "要確認": {
      icon: "⚪",
      color: "#f59e0b",
      label: "50m目安未満（40m以上50m未満）",
      action: "⚪ 50m目安未満",
      message: "40m以上50m未満です。50mは設計時の目安として表示しています。"
    }
  };

  const isReferencePair = warning => {
    if (typeof window.isExistingPoiPair === "function") {
      return window.isExistingPoiPair(warning);
    }
    const isExisting = point => /既存/.test(String(point?.originalLayer || point?.layer || ""));
    return isExisting(warning?.a) && isExisting(warning?.b);
  };

  const isTargetLayer = layerName => {
    const layer = String(layerName || "");
    if (typeof window.isAddedLayerName === "function") {
      try {
        if (window.isAddedLayerName(layer)) return true;
      } catch (_) {}
    }
    return /(追加|希望|変更)/.test(layer);
  };

  const isTargetPoint = point => {
    return isTargetLayer(point?.originalLayer || point?.layer || "");
  };

  const countAllTargetPois = () => {
    let count = 0;
    Object.entries(window._layerPoints || {}).forEach(([layerName, points]) => {
      if (!isTargetLayer(layerName) || !Array.isArray(points)) return;
      count += points.length;
    });
    return count;
  };

  const collectPairStats = warnings => {
    const affectedTargets = new Set();

    (warnings || []).forEach(warning => {
      if (isReferencePair(warning)) return;
      [warning?.a, warning?.b].forEach(point => {
        if (point && isTargetPoint(point)) affectedTargets.add(point);
      });
    });

    return {
      affectedTargetPoiCount: affectedTargets.size,
      totalTargetPoiCount: countAllTargetPois()
    };
  };

  const escapeHtml = value => {
    if (typeof window.escapeDistanceHtml === "function") {
      return window.escapeDistanceHtml(value);
    }
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  function installClassifier() {
    const classifier = distance => bandFor(distance);
    Object.defineProperty(classifier, FLAG, { value: true });
    window.classifyDistanceRisk = classifier;

    window.getRiskStyle = type => {
      const setting = settings[type] || settings["要確認"];
      return { icon: setting.icon, color: setting.color };
    };

    window.getDistanceAdvicePriority = type => {
      if (type === "密集") return 4;
      if (type === "滞留") return 3;
      if (type === "軽微") return 2;
      if (type === "要確認") return 1;
      return 0;
    };

    window.getDistanceAdviceRuleText = type => {
      return (settings[type] || settings["要確認"]).message;
    };
  }

  function installAccordion() {
    const renderer = warnings => {
      latestPairStats = collectPairStats(warnings);

      const groups = {
        "密集": { target: [], reference: [] },
        "滞留": { target: [], reference: [] },
        "軽微": { target: [], reference: [] },
        "要確認": { target: [], reference: [] }
      };

      (warnings || []).forEach(warning => {
        const type = bandFor(warning?.distance);
        if (!type) return;
        groups[type][isReferencePair(warning) ? "reference" : "target"].push(warning);
      });

      const cardHtml = (warning, type, reference) => {
        const setting = settings[type];
        const color = reference ? "#94a3b8" : setting.color;
        const label = reference ? "ℹ 既存POI同士" : setting.action;
        const message = reference
          ? "既存POI同士の近接です。現在の配置状況を把握するための参考表示です。"
          : setting.message;

        return `
          <div class="distance-band-card"
               data-distance-band="${type}"
               data-reference="${reference ? "true" : "false"}"
               style="margin:8px 0;padding:9px 10px;border-radius:10px;background:rgba(15,23,42,.65);border:1px solid rgba(148,163,184,.25);border-left:4px solid ${color};">
            <strong style="color:${color};">${label}（${Number(warning.distance).toFixed(1)}m）</strong><br>
            ${escapeHtml(warning.a?.layer)}：${escapeHtml(warning.a?.name)}<br>
            × ${escapeHtml(warning.b?.layer)}：${escapeHtml(warning.b?.name)}<br>
            → ${message}
          </div>
        `;
      };

      const groupHtml = type => {
        const setting = settings[type];
        const target = groups[type].target;
        const reference = groups[type].reference;
        const total = target.length + reference.length;

        return `
          <details style="margin-bottom:10px;padding:10px 12px 9px 14px;border-radius:12px;background:rgba(15,23,42,.45);border:1px solid rgba(148,163,184,.22);border-left:5px solid ${setting.color};">
            <summary style="cursor:pointer;font-weight:bold;color:${setting.color};font-size:15px;line-height:1.45;">
              ${setting.icon} ${setting.label}（${total}組）
            </summary>
            <div style="margin-top:8px;padding:7px 0 0 2px;border-top:1px solid rgba(148,163,184,.18);">
              <div style="margin-bottom:8px;font-size:12px;color:#cbd5e1;">追加・変更POIを含むペア：${target.length}組 / 既存POI同士：${reference.length}組</div>
              <details style="margin-bottom:8px;padding:8px 10px;border-radius:10px;background:rgba(15,23,42,.38);border:1px solid rgba(148,163,184,.20);">
                <summary style="cursor:pointer;font-weight:bold;color:${setting.color};">${setting.action}（${target.length}組）</summary>
                <div style="margin-top:7px;">${target.length ? target.map(w => cardHtml(w, type, false)).join("") : '<div style="opacity:.7;">該当なし</div>'}</div>
              </details>
              <details style="padding:8px 10px;border-radius:10px;background:rgba(148,163,184,.08);border:1px solid rgba(148,163,184,.18);">
                <summary style="cursor:pointer;font-weight:bold;color:#cbd5e1;">ℹ 既存POI同士（${reference.length}組）</summary>
                <div style="margin-top:7px;">${reference.length ? reference.map(w => cardHtml(w, type, true)).join("") : '<div style="opacity:.7;">該当なし</div>'}</div>
              </details>
            </div>
          </details>
        `;
      };

      return `
        <div style="margin:0 0 12px;padding:11px 13px;border-radius:12px;background:rgba(56,189,248,.07);border:1px solid rgba(56,189,248,.24);color:#cbd5e1;font-size:12px;line-height:1.7;">
          ${DISCLAIMER}<br>
          ※「組」はPOI同士の組み合わせ数です。同じPOIが複数の組み合わせに含まれる場合があります。
        </div>
        <div class="distance-warning">${Object.keys(groups).map(groupHtml).join("")}</div>
      `;
    };

    Object.defineProperty(renderer, FLAG, { value: true });
    window.getRiskAccordionHtml = renderer;
  }

  function renderedCounts() {
    const counts = { dense: 0, stay: 0, light: 0, near50: 0, reference: 0 };
    document.querySelectorAll("#distanceResult .distance-band-card").forEach(card => {
      if (card.dataset.reference === "true") {
        counts.reference += 1;
        return;
      }
      if (card.dataset.distanceBand === "密集") counts.dense += 1;
      else if (card.dataset.distanceBand === "滞留") counts.stay += 1;
      else if (card.dataset.distanceBand === "軽微") counts.light += 1;
      else if (card.dataset.distanceBand === "要確認") counts.near50 += 1;
    });
    return counts;
  }

  function installJudgementNormalizer() {
    const normalizer = section => {
      const card = section?.querySelector(".distance-warning");
      if (!card) return;

      const counts = renderedCounts();
      const totalPairs = counts.dense + counts.stay + counts.light + counts.near50;
      const affectedTargetPoiCount = latestPairStats.affectedTargetPoiCount || 0;
      const totalTargetPoiCount = Math.max(
        latestPairStats.totalTargetPoiCount || 0,
        affectedTargetPoiCount
      );

      let status = "50m以上のみ";
      let icon = "✅";
      let color = "#22c55e";

      if (counts.dense + counts.stay > 0) {
        status = "近い組み合わせあり";
        icon = "📏";
        color = "#f97316";
      } else if (counts.light + counts.near50 > 0) {
        status = "50m目安未満あり";
        icon = "📏";
        color = "#f59e0b";
      } else if (counts.reference > 0) {
        status = "既存POIの近接あり";
        icon = "ℹ";
        color = "#94a3b8";
      }

      const targetPoiLine = totalTargetPoiCount > 0
        ? `該当する追加・変更POI：${affectedTargetPoiCount} / ${totalTargetPoiCount}件<br>`
        : `該当する追加・変更POI：${affectedTargetPoiCount}件<br>`;

      const nextHtml = `
        <strong style="color:${color};font-size:20px;">${icon} 距離チェック結果：${status}</strong><br><br>
        🔴 20m未満（密集の目安）：${counts.dense}組<br>
        🟠 20m以上30m未満（滞留の目安）：${counts.stay}組<br>
        🟡 30m以上40m未満（近接の目安）：${counts.light}組<br>
        ⚪ 40m以上50m未満（50m目安未満）：${counts.near50}組<br>
        既存POI同士の50m未満：${counts.reference}組<br>
        <strong>追加・変更POIを含む50m未満のペア：${totalPairs}組</strong><br>
        ${targetPoiLine}<br>
        ${totalPairs === 0 ? "追加・変更POIを含む50m未満のペアはありません。" : "50m未満のペアがあります。距離と地図を設計時の参考として確認できます。"}<br><br>
        <span style="font-size:12px;color:#cbd5e1;">※「組」はPOI同士の組み合わせ数です。同じPOIが複数のペアに含まれる場合があります。</span><br>
        <span style="font-size:12px;color:#cbd5e1;">${DISCLAIMER}</span>
      `;

      card.style.borderColor = color;
      if (card.innerHTML !== nextHtml) card.innerHTML = nextHtml;
    };

    Object.defineProperty(normalizer, FLAG, { value: true });
    window.normalizeJudgementSection = normalizer;
  }

  function normalizeScorePairUnits() {
    const sections = Array.from(document.querySelectorAll("#distanceResult .distance-result-section"));
    const scoreSection = sections.find(section => {
      const heading = section.querySelector(".distance-result-heading");
      return (heading?.textContent || "").includes("拠点充実度");
    });
    if (!scoreSection) return;

    scoreSection.querySelectorAll(".distance-warning").forEach(card => {
      const nextHtml = card.innerHTML
        .replace(/密集：(\d+)件/g, "密集ペア：$1組")
        .replace(/滞留：(\d+)件/g, "滞留ペア：$1組")
        .replace(/30〜50m参考：(\d+)件/g, "30〜50m未満ペア（参考）：$1組")
        .replace(/既存POI同士の50m未満近接：(\d+)件/g, "既存POI同士の50m未満ペア：$1組");
      if (card.innerHTML !== nextHtml) card.innerHTML = nextHtml;
    });
  }

  function updateGuide() {
    const guide = document.querySelector("#distance .rank-guide-box");
    if (!guide) return;
    const nextHtml = `
      <strong>距離の見方（設計支援）</strong><br><br>
      🔴 20m未満：密集の目安。イベント時の人の集まり方を見る参考値です。<br><br>
      🟠 20m以上30m未満：滞留の目安。イベント時の滞留を考える参考値です。<br><br>
      🟡 30m以上40m未満：近接の目安。周辺状況を見るための参考値です。<br><br>
      ⚪ 40m以上50m未満：50m目安未満。設計時の距離感を見る参考値です。<br><br>
      ✅ 50m以上：50m以上の間隔があります。<br><br>
      <span style="opacity:.9;">※件数ではなく、POI同士の「組み合わせ数」は「組」で表示します。</span><br>
      <span style="opacity:.9;">※「通行」は距離の閾値ではなく、狭い通路・入口・信号周辺などの現地環境を確認する項目です。</span><br>
      <span style="opacity:.9;">${DISCLAIMER}</span>
    `;
    if (guide.innerHTML !== nextHtml) guide.innerHTML = nextHtml;
  }

  function patchMapRenderer() {
    const original = window.renderSimpleDistanceMap;
    if (typeof original !== "function" || original[FLAG]) return;

    try {
      let source = original.toString();
      const before = source;
      source = source.replace(
        `<div>\n          <span class="distance-legend-line light"></span>\n          30〜40m\n        </div>\n\n        <div>`,
        `<div>\n          <span class="distance-legend-line light"></span>\n          30〜40m（近接の目安）\n        </div>\n\n        <div>\n          <span class="distance-legend-line light" style="border-top-color:#f59e0b;"></span>\n          40〜50m未満（50m目安未満）\n        </div>\n\n        <div>`
      );
      source = source.replace(
        `    let color = "#facc15";\n    let label = "軽微";\n\n    if (w.distance < 20) {\n      color = "#ef4444";\n      label = "密集";\n    } else if (w.distance < 30) {\n      color = "#f97316";\n      label = "滞留";\n    }`,
        `    let color = "#f59e0b";\n    let label = "50m目安未満";\n\n    if (w.distance < 20) {\n      color = "#ef4444";\n      label = "密集の目安";\n    } else if (w.distance < 30) {\n      color = "#f97316";\n      label = "滞留の目安";\n    } else if (w.distance < 40) {\n      color = "#facc15";\n      label = "近接の目安";\n    }`
      );
      if (source === before) return;
      const patched = Function(`"use strict"; return (${source});`)();
      Object.defineProperty(patched, FLAG, { value: true });
      window.renderSimpleDistanceMap = patched;
    } catch (error) {
      console.warn("[distance-band-clarity] map patch failed", error);
    }
  }

  function refreshResult() {
    updateGuide();
    normalizeScorePairUnits();

    const result = document.getElementById("distanceResult");
    if (!result) return;
    const section = Array.from(result.querySelectorAll(".distance-result-section")).find(node => {
      const heading = node.querySelector(".distance-result-heading");
      const text = heading?.textContent || "";
      if (text.includes("判定結果") || text.includes("距離チェック結果")) {
        if (heading && text.includes("判定結果")) heading.textContent = "距離チェック結果";
        return true;
      }
      return false;
    });
    if (section) window.normalizeJudgementSection?.(section);
  }

  function installResultObserver() {
    const result = document.getElementById("distanceResult");
    if (!result || result.dataset.distanceBandClarityV2Observer === "true") return;
    result.dataset.distanceBandClarityV2Observer = "true";
    new MutationObserver(() => queueMicrotask(refreshResult))
      .observe(result, { childList: true });
  }

  function applyAll() {
    if (!document.getElementById("distance")) return;
    installClassifier();
    installAccordion();
    installJudgementNormalizer();
    patchMapRenderer();
    updateGuide();
    installResultObserver();
    refreshResult();
  }

  applyAll();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyAll, { once: true });
  }
  [0, 250, 800, 1600, 3000].forEach(delay => setTimeout(applyAll, delay));
})();