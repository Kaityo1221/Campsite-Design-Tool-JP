// ======================================================
// CAMP-009: KML/KMZ 異常系メッセージ整理
// ======================================================

function createKmlKmzErrorMessage(errorType, detail = "") {
  const detailText = detail
    ? `<br><small>${escapeDistanceHtml(String(detail))}</small>`
    : "";

  const messages = {
    no_file: `
      ⚠ ファイルが選択されていません。<br>
      KML または KMZ ファイルを選択してください。
    `,

    unsupported_extension: `
      ⚠ 対応していないファイル形式です。<br>
      読み込めるのは <strong>.kml</strong> または <strong>.kmz</strong> です。<br>
      Google My Maps から出力した完成KMZを選択してください。
      ${detailText}
    `,

    zip_instead_of_kmz: `
      ⚠ ZIPファイルはそのままでは読み込めません。<br>
      Google My Maps からエクスポートした <strong>.kmz</strong> ファイルを選択してください。<br>
      もしZIPとして保存されている場合は、拡張子や出力方法を確認してください。
      ${detailText}
    `,

    kmz_without_kml: `
      ⚠ KMZの中にKMLファイルが見つかりませんでした。<br>
      Google My Maps から再度エクスポートしてください。<br>
      「レイヤをKML/KMZにエクスポート」ではなく、完成版のKMZを使ってください。
      ${detailText}
    `,

    KML_NOT_FOUND: `
      ⚠ KMZ内にKMLファイルが見つかりませんでした。<br>
      Google My Mapsから書き出した完成KMZか確認してください。<br>
      KMZ内にKMLファイルが見つからないため、読み込めません。
      ${detailText}
    `,

    empty_kml: `
      ⚠ KMLの中身が空、または読み取れるデータがありません。<br>
      My Maps上にPOI・線・ポリゴンが入っているか確認してください。
      ${detailText}
    `,

    parse_failed: `
      ⚠ KML/KMZの解析に失敗しました。<br>
      ファイルが壊れているか、対応していない形式の可能性があります。<br>
      Google My Maps から再エクスポートして、もう一度試してください。
      ${detailText}
    `,

    jszip_unavailable: `
      ⚠ KMZ処理ライブラリを読み込めませんでした。<br>
      通信環境を確認して、ページを再読み込みしてください。
      ${detailText}
    `,

    no_placemark: `
      ⚠ KML内にPlacemarkが見つかりませんでした。<br>
      POI、ルート線、活動範囲ポリゴンが入っているか確認してください。
      ${detailText}
    `,

    no_poi: `
      ⚠ POIとして読み取れる地点が見つかりませんでした。<br>
      My Maps上の地点データ、またはレイヤー名を確認してください。
      ${detailText}
    `,

    unknown: `
      ⚠ ファイルの読み込み中にエラーが発生しました。<br>
      KML/KMZの形式を確認してください。
      ${detailText}
    `
  };

  return messages[errorType] || messages.unknown;
}

function showKmlKmzError(targetElementId, errorType, detail = "") {
  const target = document.getElementById(targetElementId);

  const html = `
    <div class="distance-warning">
      ${createKmlKmzErrorMessage(errorType, detail)}
    </div>
  `;

  if (target) {
    target.innerHTML = html;
  } else {
    alert(
      createKmlKmzErrorMessage(errorType, detail)
        .replace(/<br>/g, "\n")
        .replace(/<[^>]+>/g, "")
    );
  }
}

// ======================================================
// Phase 9: 距離チェック保存用レポート
// 外部共有を促進せず、端末内TXT保存のみ提供する。
// ======================================================

function getDistanceReportTargetPoints() {
  const points = [];

  Object.entries(window._layerPoints || {}).forEach(([layerName, layerPoints]) => {
    const isCsvLayer = layerName === "CSV_POI";
    if (!isCsvLayer && typeof isDistanceTargetLayer === "function" && !isDistanceTargetLayer(layerName)) {
      return;
    }

    (layerPoints || []).forEach(point => {
      points.push({
        ...point,
        layer: typeof cleanLayerName === "function" ? cleanLayerName(layerName) : layerName,
        originalLayer: layerName
      });
    });
  });

  return points;
}

function getDistanceReportSiteName(points) {
  if (typeof guessParkNameFromPoints === "function") {
    const guessed = guessParkNameFromPoints(points);
    if (guessed && guessed !== "公園名不明") return guessed;
  }

  const sourceName = window._distanceSourceFile?.name || "";
  if (sourceName) {
    return sourceName.replace(/\.(kmz|kml|zip)$/i, "");
  }

  return "名称未取得";
}

function getDistanceReportCheckLine(id, checkedText, uncheckedText) {
  return document.getElementById(id)?.checked ? checkedText : uncheckedText;
}

function buildDistanceSavedReport() {
  const result = document.getElementById("distanceResult");
  if (!result || !result.textContent.trim()) return "";

  const points = getDistanceReportTargetPoints();
  const siteName = getDistanceReportSiteName(points);
  const sourceName = window._distanceSourceFile?.name || "未取得";
  const generatedAt = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date());

  let existingCount = 0;
  let addedCount = 0;
  if (typeof countExistingAndAddedPoi === "function") {
    const counts = countExistingAndAddedPoi(window._layerPoints || {});
    existingCount = counts.existing || 0;
    addedCount = counts.added || 0;
  }

  let typeLine = "POI種別：取得できませんでした";
  if (typeof countPoiTypesFromLayers === "function") {
    const types = countPoiTypesFromLayers(window._layerPoints || {});
    typeLine = `POI種別：ポケストップ ${types.pokestop || 0} / ジム ${types.gym || 0} / パワースポット ${types.power || 0}`;
  }

  const resultClone = result.cloneNode(true);
  resultClone.querySelector("#distanceReportActions")?.remove();
  const resultText = (resultClone.innerText || resultClone.textContent || "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return [
    "Campsite Design Tool 保存用レポート",
    "================================",
    `拠点名：${siteName}`,
    `作成日時：${generatedAt}`,
    `元ファイル：${sourceName}`,
    "",
    "【POI内訳】",
    `判定対象POI：${points.length}件`,
    `既存POI：${existingCount}件`,
    `追加POI：${addedCount}件`,
    typeLine,
    "",
    "【現地環境チェック】",
    `通行：${getDistanceReportCheckLine("trafficOk", "スムーズに通れる", "注意が必要")}`,
    `広場：${getDistanceReportCheckLine("hasOpenSpace", "あり", "なし")}`,
    `回遊：${getDistanceReportCheckLine("hasLoopRoute", "できる", "弱い")}`,
    `待機場所：${getDistanceReportCheckLine("hasWaitingSpace", "あり", "なし")}`,
    "",
    "【距離チェック結果】",
    resultText,
    "",
    "【取扱い注意】",
    "このレポートにはキャンプサイト設計情報が含まれます。外部SNS・チャットへの共有は想定していません。端末内での確認・保管用として扱ってください。",
    "",
    "【確認メモ】",
    "このレポートは距離チェック時点の確認結果です。最終提出前に提出前チェックリストも確認してください。"
  ].join("\n");
}

function getDistanceReportFileName() {
  const points = getDistanceReportTargetPoints();
  const siteName = getDistanceReportSiteName(points)
    .replace(/[\\/:*?\"<>|]/g, "_")
    .trim() || "campsite";

  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("");

  return `${siteName}_距離チェック_${date}.txt`;
}

function downloadDistanceSavedReport() {
  const report = buildDistanceSavedReport();
  if (!report) return;

  const blob = new Blob(["\ufeff", report], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = getDistanceReportFileName();
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ensureDistanceReportActions() {
  const result = document.getElementById("distanceResult");
  if (!result || !result.textContent.trim() || result.querySelector("#distanceReportActions")) return;

  const actions = document.createElement("div");
  actions.id = "distanceReportActions";
  actions.style.cssText = [
    "margin:18px 0 4px",
    "padding:16px",
    "border:1px solid rgba(56,189,248,.35)",
    "border-radius:14px",
    "background:rgba(14,165,233,.08)"
  ].join(";");

  actions.innerHTML = `
    <div style="font-weight:900;color:#7dd3fc;margin-bottom:5px;">📄 保存用レポート</div>
    <div style="font-size:12px;line-height:1.7;color:#cbd5e1;margin-bottom:12px;">
      距離チェック結果を端末内へTXTファイルとして保存します。<br>
      <strong style="color:#fde68a;">設計情報を含むため、外部SNS・チャットへの共有は想定していません。</strong>
    </div>
    <button type="button" data-distance-report-save style="width:100%;padding:11px 10px;border:1px solid rgba(56,189,248,.45);border-radius:10px;background:rgba(56,189,248,.16);color:#e0f2fe;font-weight:800;cursor:pointer;">TXTとして端末に保存</button>
  `;

  actions.querySelector("[data-distance-report-save]")?.addEventListener("click", downloadDistanceSavedReport);
  result.appendChild(actions);
}

function setupDistanceReportObserver() {
  const result = document.getElementById("distanceResult");
  if (!result || result.dataset.reportObserverReady === "true") return;

  result.dataset.reportObserverReady = "true";
  const observer = new MutationObserver(() => {
    requestAnimationFrame(ensureDistanceReportActions);
  });

  observer.observe(result, { childList: true, subtree: true });
  ensureDistanceReportActions();
}

document.addEventListener("DOMContentLoaded", setupDistanceReportObserver);

// ======================================================
// Phase 10: 作成前の拠点診断を遅延読み込み
// ======================================================

function loadSiteDiagnosisFeature() {
  if (document.querySelector('script[data-site-diagnosis-loader="true"]')) return;

  const script = document.createElement("script");
  script.src = "js/site-diagnosis.js?v=2";
  script.async = false;
  script.dataset.siteDiagnosisLoader = "true";
  script.addEventListener("load", loadCampsiteKnowledgeFeature, { once: true });
  document.body.appendChild(script);
}

// ======================================================
// Phase 11: 必須確認 / 推奨 / 経験則の知見基盤
// Phase 10の診断UIが読み込まれた後に追加する。
// ======================================================

function loadCampsiteKnowledgeFeature() {
  if (document.querySelector('script[data-campsite-knowledge-loader="true"]')) return;

  const script = document.createElement("script");
  script.src = "js/campsite-knowledge.js?v=1";
  script.async = false;
  script.dataset.campsiteKnowledgeLoader = "true";
  document.body.appendChild(script);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadSiteDiagnosisFeature);
} else {
  loadSiteDiagnosisFeature();
}
