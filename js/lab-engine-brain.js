/* =========================
   CAMP-108: LabEngine Brain
   - 3人レビューで承認済みの辞書 + 推論ルールをLabEngine本体分類へ投入
   - lab.html 内だけで使う
   - index.html / 距離チェック / マップ表示制御 / マイマップコメントには接続しない
========================= */

const LABENGINE_ACTIVE_DICTIONARY_VERSION = "2026-06-sugaya-v1";

let labEngineBrainCache = null;
let labEngineBrainLoadingPromise = null;

function normalizeLabEngineName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function convertLabEngineCategoryKey(category) {
  const key = String(category || "").toUpperCase();

  if (key === "REST") return { key: "rest", label: "休憩" };
  if (key === "STAY") return { key: "stay", label: "滞在" };
  if (key === "LOOP") return { key: "loop", label: "回遊" };
  if (key === "CAUTION") return { key: "caution", label: "注意" };

  // HOLD / EXCLUDE はPOIを消す意味ではない。
  // LabEngine本体では未分類フォルダへ置き、人間確認対象として扱う。
  return { key: "unknown", label: "未分類" };
}

function escapeRegExpForLabEngine(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sqlLikePatternToRegExp(pattern) {
  const raw = String(pattern || "");
  let source = "";

  for (const char of raw) {
    if (char === "%") {
      source += ".*";
    } else if (char === "_") {
      source += ".";
    } else {
      source += escapeRegExpForLabEngine(char);
    }
  }

  return new RegExp(source, "i");
}

function getLabEnginePointName(point) {
  return String(
    point?.name ||
    point?.title ||
    point?.poi_name ||
    point?.displayName ||
    ""
  );
}

async function loadLabEngineBrainFromSupabase() {
  if (labEngineBrainCache) {
    return labEngineBrainCache;
  }

  if (labEngineBrainLoadingPromise) {
    return labEngineBrainLoadingPromise;
  }

  labEngineBrainLoadingPromise = (async () => {
    if (!window.campsiteSupabase) {
  console.warn("Supabase未接続のため、LabEngine学習辞書と推論ルールは読み込みません。");

  window.LabEngineLearningStats?.setLoadCounts({
    dictionaryCount: 0,
    ruleCount: 0
  });

  labEngineBrainCache = {
    dictionary: [],
    rules: []
  };
  return labEngineBrainCache;
}

    try {
      const [dictionaryResult, rulesResult] = await Promise.all([
        window.campsiteSupabase
          .from("published_name_dictionary")
          .select(`
            dictionary_version,
            normalized_name,
            poi_name,
            final_category,
            dictionary_action,
            reason_code,
            confidence_score,
            active
          `)
          .eq("active", true),

        window.campsiteSupabase
          .from("labengine_name_inference_rules")
          .select(`
            rule_name,
            rule_type,
            match_pattern,
            final_category,
            dictionary_action,
            reason_code,
            confidence_score,
            active
          `)
          .eq("active", true)
          .order("confidence_score", { ascending: false })
      ]);

      if (dictionaryResult.error) {
  console.warn("LabEngine学習辞書の読み込みに失敗しました:", dictionaryResult.error);
  window.LabEngineLearningStats?.setLoadError(
    dictionaryResult.error.message || dictionaryResult.error
  );
}

if (rulesResult.error) {
  console.warn("LabEngine推論ルールの読み込みに失敗しました:", rulesResult.error);
  window.LabEngineLearningStats?.setLoadError(
    rulesResult.error.message || rulesResult.error
  );
}

      const dictionary = Array.isArray(dictionaryResult.data)
        ? dictionaryResult.data
        : [];

      const rules = Array.isArray(rulesResult.data)
        ? rulesResult.data
        : [];
window.LabEngineLearningStats?.setLoadCounts({
  dictionaryCount: dictionary.length,
  ruleCount: rules.length
});
      labEngineBrainCache = {
        dictionary,
        rules
      };

      console.log(
        `LabEngine Brain読込: 辞書${dictionary.length}件 / 推論ルール${rules.length}件`
      );

      return labEngineBrainCache;
    } catch (error) {
  console.warn("LabEngine Brain読込エラー。既存ルールだけで続行します:", error);

  window.LabEngineLearningStats?.setLoadError(error);

  window.LabEngineLearningStats?.setLoadCounts({
    dictionaryCount: 0,
    ruleCount: 0
  });

  labEngineBrainCache = {
    dictionary: [],
    rules: []
  };
  return labEngineBrainCache;
}
  })();

  return labEngineBrainLoadingPromise;
}

function findLabEngineDictionaryMatch(name, dictionary) {
  const normalizedName = normalizeLabEngineName(name);

  if (!normalizedName) return null;

  return (dictionary || []).find(row => {
    const normalizedDictionaryName = normalizeLabEngineName(row.normalized_name);
    const normalizedPoiName = normalizeLabEngineName(row.poi_name);

    return (
      normalizedName === normalizedDictionaryName ||
      normalizedName === normalizedPoiName
    );
  }) || null;
}

function findLabEngineRuleMatch(name, rules) {
  const target = String(name || "");

  if (!target) return null;

  for (const rule of rules || []) {
    const ruleType = String(rule.rule_type || "ILIKE").toUpperCase();
    const pattern = String(rule.match_pattern || "");

    if (!pattern) continue;

    if (ruleType === "ILIKE" || ruleType === "LIKE") {
      const regExp = sqlLikePatternToRegExp(pattern);
      if (regExp.test(target)) {
        return rule;
      }
    }
  }

  return null;
}

function applyLabEngineBrainMatch(point, match, sourceType) {
  const category = convertLabEngineCategoryKey(match.final_category);

  return {
    ...point,
    _labCategoryKey: category.key,
    _labCategoryLabel: category.label,
    _labEngineBrainMatched: true,
    _labEngineBrainSource: sourceType,
    _labEngineBrainName:
      match.rule_name ||
      match.normalized_name ||
      match.poi_name ||
      "",
    _labEngineAction: match.dictionary_action || "",
    _labEngineReasonCode: match.reason_code || "",
    _labEngineConfidenceScore: Number(match.confidence_score || 0)
  };
}

window.enrichLabPointsWithLabEngineBrain = async function(points) {
  const brain = await loadLabEngineBrainFromSupabase();

  const dictionary = brain.dictionary || [];
  const rules = brain.rules || [];

  if (!dictionary.length && !rules.length) {
    console.log("LabEngine Brainは空です。既存のLabEngine分類だけで続行します。");
    return points;
  }

  let dictionaryMatchedCount = 0;
  let ruleMatchedCount = 0;

  const enrichedPoints = (points || []).map(point => {
    const name = getLabEnginePointName(point);

    const dictionaryMatch = findLabEngineDictionaryMatch(name, dictionary);

    if (dictionaryMatch) {
      dictionaryMatchedCount += 1;
      return applyLabEngineBrainMatch(
        point,
        dictionaryMatch,
        "published_name_dictionary"
      );
    }

    const ruleMatch = findLabEngineRuleMatch(name, rules);

    if (ruleMatch) {
      ruleMatchedCount += 1;
      return applyLabEngineBrainMatch(
        point,
        ruleMatch,
        "labengine_name_inference_rules"
      );
    }

    return point;
  });

  console.log(
    `LabEngine Brain分類: 辞書${dictionaryMatchedCount}件 / 推論${ruleMatchedCount}件 / 全${points.length}件`
  );

  return enrichedPoints;
};

// ======================================================
// CAMP-109: LabEngine 学習判定 内訳カウンター
// ======================================================

window.LabEngineLearningStats = (() => {
  const state = {
    dictionaryCount: 0,
    ruleCount: 0,
    dictionaryHit: 0,
    inferenceRuleHit: 0,
    unmatched: 0,
    totalJudged: 0,
    dictionaryLoadOk: false,
    ruleLoadOk: false,
    lastError: ""
  };

  function reset() {
    state.dictionaryHit = 0;
    state.inferenceRuleHit = 0;
    state.unmatched = 0;
    state.totalJudged = 0;
    state.lastError = "";
  }

  function setLoadCounts({ dictionaryCount = 0, ruleCount = 0 } = {}) {
    state.dictionaryCount = Number(dictionaryCount || 0);
    state.ruleCount = Number(ruleCount || 0);
    state.dictionaryLoadOk = state.dictionaryCount > 0;
    state.ruleLoadOk = state.ruleCount > 0;
  }

  function setLoadError(error) {
    state.lastError = error ? String(error) : "";
  }

  function recordDecision(result) {
  state.totalJudged += 1;

  const source = String(
    result?.source ||
    result?.matchSource ||
    result?.decisionSource ||
    result?.learningSource ||
    result?.type ||
    result?._labEngineBrainSource ||
    result?._labEngineBrainMatchSource ||
    result?._labEngineBrainDecisionSource ||
    ""
  ).toLowerCase();

  const hasDictionaryId =
    !!result?.dictionary_id ||
    !!result?.dictionaryId ||
    !!result?._labEngineBrainDictionaryId ||
    !!result?._labEngineBrainDictionaryVersion;

  const hasRuleId =
    !!result?.rule_id ||
    !!result?.ruleId ||
    !!result?.inference_rule_id ||
    !!result?.inferenceRuleId ||
    !!result?._labEngineBrainRuleId ||
    !!result?._labEngineBrainRuleName;

  const isBrainMatched =
    result?.matched === true ||
    result?._labEngineBrainMatched === true;

  if (
    hasDictionaryId ||
    source.includes("dictionary") ||
    source.includes("dict") ||
    source.includes("辞書")
  ) {
    state.dictionaryHit += 1;
    return;
  }

  if (
    hasRuleId ||
    source.includes("inference") ||
    source.includes("rule") ||
    source.includes("推論")
  ) {
    state.inferenceRuleHit += 1;
    return;
  }

  // CAMP-109:
  // LabEngine Brainで一致しているが、辞書/ルール種別フィールドが無い場合は
  // 推論ルール側として扱い、学習判定0件にならないようにする。
  if (isBrainMatched) {
    state.inferenceRuleHit += 1;
    return;
  }

  state.unmatched += 1;
}
  function getBreakdown() {
    const learningHit = state.dictionaryHit + state.inferenceRuleHit;

    let diagnosis = "";

    if (state.dictionaryCount === 0 && state.ruleCount === 0) {
      diagnosis = "辞書・推論ルールが読み込まれていない可能性があります。Supabase接続または読込処理を確認してください。";
    } else if (learningHit === 0) {
      diagnosis = "辞書・推論ルールは読み込まれていますが、今回のPOI名には一致しませんでした。";
    } else {
      diagnosis = "学習済みデータによる判定が使用されています。";
    }

    return {
      dictionaryCount: state.dictionaryCount,
      ruleCount: state.ruleCount,
      dictionaryHit: state.dictionaryHit,
      inferenceRuleHit: state.inferenceRuleHit,
      unmatched: state.unmatched,
      totalJudged: state.totalJudged,
      learningHit,
      dictionaryLoadOk: state.dictionaryLoadOk,
      ruleLoadOk: state.ruleLoadOk,
      lastError: state.lastError,
      diagnosis
    };
  }

  return {
    reset,
    setLoadCounts,
    setLoadError,
    recordDecision,
    getBreakdown
  };
})();