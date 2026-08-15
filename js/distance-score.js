function calculateCampsiteScore(points, warnings) {
  let score = 100;

  // 拠点充実度は、既存POI同士を含む拠点全体の近接状況を評価します。
  // 既存POI同士はスコアへ反映しつつ、配置を変更できないため参考情報として表示します。
  const scoringWarnings = warnings || [];
  const distanceTargetMeters = window.CampsitePoiSpacingPolicy?.targetMeters || 50;

  let under20 = 0;
  let under30 = 0;
  // 互換性のためプロパティ名は under40 のまま維持するが、現在は30m以上50m未満を数える。
  let under40 = 0;
  // 互換性のためプロパティ名は referenceUnder40 のまま維持するが、現在は50m未満を数える。
  let referenceUnder40 = 0;
  let distancePenalty = 0;

  (warnings || []).forEach(w => {
    if (isExistingPoiPair(w) && w.distance < distanceTargetMeters) {
      referenceUnder40++;
    }
  });

  scoringWarnings.forEach(w => {
    const d = w.distance;

    if (d < 20) {
      distancePenalty += 4;
      under20++;
    } else if (d < 30) {
      distancePenalty += 2;
      under30++;
    } else if (d < distanceTargetMeters) {
      distancePenalty += 0.5;
      under40++;
    }
  });

  distancePenalty = Math.min(distancePenalty, 25);
  score -= distancePenalty;

  let stayPenalty = 0;

  scoringWarnings.forEach(w => {
    const d = w.distance;
    const a = (w.a.layer || "").toLowerCase();
    const b = (w.b.layer || "").toLowerCase();

    const aPower = a.includes("power") || a.includes("パワ");
    const bPower = b.includes("power") || b.includes("パワ");
    const aGym = a.includes("gym") || a.includes("ジム");
    const bGym = b.includes("gym") || b.includes("ジム");

    if (aPower && bPower) {
      if (d < 20) stayPenalty += 4;
      else if (d < 30) stayPenalty += 2;
    }

    if (aGym && bGym) {
      if (d < 20) stayPenalty += 2;
      else if (d < 30) stayPenalty += 1;
    }

    if ((aGym && bPower) || (aPower && bGym)) {
      if (d < 30) stayPenalty += 3;
    }
  });

  stayPenalty = Math.min(stayPenalty, 20);
  score -= stayPenalty;

  const trafficOk = document.getElementById("trafficOk")?.checked;
  score += trafficOk ? 3 : -5;

  let env = 0;
  if (document.getElementById("hasOpenSpace")?.checked) env += 6;
  if (document.getElementById("hasLoopRoute")?.checked) env += 5;
  if (document.getElementById("hasWaitingSpace")?.checked) env += 4;

  env = Math.min(env, 15);
  score += env;

  score = Math.round(Math.max(0, Math.min(100, score)));

  let rank = "C";
  let label = "調整あり";

  if (score >= 85) {
    rank = "S";
    label = "理想";
  } else if (score >= 70) {
    rank = "A";
    label = "かなり良い";
  } else if (score >= 60) {
    rank = "B";
    label = "良好";
  } else {
    rank = "C";
    label = "調整推奨";
  }

  let type = "バランス型";
  if (under20 > 0 || under30 >= 5) {
    type = "密集注意型";
  } else if (!trafficOk) {
    type = "通行注意型";
  } else if (trafficOk && env >= 10) {
    type = "回遊・滞留向き";
  }

  const comments = [];
  if (under20 > 0) comments.push("密集あり");
  if (under30 > 0) comments.push("滞留あり");
  if (referenceUnder40 > 0 && under20 + under30 + under40 === 0) {
    comments.push("既存POI同士の参考近接あり");
  }
  if (!trafficOk) comments.push("通行注意");
  if (env >= 10) comments.push("環境良好");

  let summary = "バランスの取れた拠点です";

const densityCount = under20 + under30 + under40;
const hasDensity = densityCount > 0;
const hasStrongDensity = under20 > 0 || under30 >= 5;

if (rank === "S") {
  if (hasDensity) {
    summary = "既存POIの密度はありますが、現地条件が良く、非常に運用しやすい拠点です";
  } else {
    summary = "距離・通行・回遊性のバランスが良い理想的な拠点です";
  }
} else if (rank === "A") {
  if (hasStrongDensity) {
    summary = "既存POIの密度は高めですが、通行・広場・回遊性で補える拠点です。追加配置は慎重に確認してください";
  } else if (!trafficOk) {
    summary = "通行面に注意は必要ですが、全体としてはかなり良い拠点です";
  } else {
    summary = "多少の注意点はありますが、全体としてかなり良い拠点です";
  }
} else if (rank === "B") {
  if (hasStrongDensity) {
    summary = "既存POIの密度が高く、追加配置には注意が必要です";
  } else if (!trafficOk) {
    summary = "通行面に注意が必要です。現地確認を前提に調整してください";
  } else {
    summary = "一部に注意点があります。配置や導線を確認してください";
  }
} else {
  if (hasStrongDensity) {
    summary = "密集が強く、追加配置・動線設計の見直しが必要です";
  } else if (!trafficOk) {
    summary = "通行面の懸念が大きいため、現地確認と導線調整が必要です";
  } else {
    summary = "複数の注意点があります。配置計画を見直してください";
  }
}

  return {
    score,
    rank,
    type,
    label,
    under20,
    under30,
    under40,
    referenceUnder40,
    trafficOk,
    comments,
    summary
  };
}