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
  if (key === "HOLD") return { key: "hold", label: "保留" };
  if (key === "EXCLUDE") return { key: "exclude", label: "除外" };

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
function shouldUseKasaiFinalDecisionMaster(points = []) {
  const text = (points || [])
    .map(point => {
      return [
        getLabEnginePointName(point),
        point?.description,
        point?.park_name,
        point?.parkName,
        point?._sourceFile
      ]
        .filter(Boolean)
        .join(" ");
    })
    .join(" ");

  return /葛西|kasai/i.test(text);
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

function getLabEngineRulePriority(rule) {
  const category = String(rule?.final_category || "").toUpperCase();

  // 安全・保留・除外系は最優先
  if (category === "EXCLUDE") return 100;
  if (category === "HOLD") return 90;
  if (category === "CAUTION") return 80;

  // 休憩・滞在・回遊は同列。
  // この中では confidence_score が高いルールを勝たせる。
  if (category === "REST") return 60;
  if (category === "STAY") return 60;
  if (category === "LOOP") return 60;

  return 0;
}

function findLabEngineRuleMatch(name, rules) {
  const target = String(name || "");

  if (!target) return null;

  const matchedRules = [];

  for (const rule of rules || []) {
    const ruleType = String(rule.rule_type || "ILIKE").toUpperCase();
    const pattern = String(rule.match_pattern || "");

    if (!pattern) continue;

    if (ruleType === "ILIKE" || ruleType === "LIKE") {
      const regExp = sqlLikePatternToRegExp(pattern);
      if (regExp.test(target)) {
        matchedRules.push(rule);
      }
    }
  }

  if (!matchedRules.length) return null;

  matchedRules.sort((a, b) => {
    const pa = getLabEngineRulePriority(a);
    const pb = getLabEngineRulePriority(b);

    if (pb !== pa) {
      return pb - pa;
    }

    return Number(b.confidence_score || 0) - Number(a.confidence_score || 0);
  });

  return matchedRules[0];
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
const useKasaiFinalDecisionMaster =
  shouldUseKasaiFinalDecisionMaster(points);

const engineDecisions =
  useKasaiFinalDecisionMaster &&
  typeof window.loadCampsiteEngineDecisions === "function"
    ? await window.loadCampsiteEngineDecisions("kasai-rinkai-20260625-v1")
    : [];

if (!useKasaiFinalDecisionMaster) {
  console.log("葛西最終判定マスターは対象外のため使用しません。汎用推論ルールで判定します。");
}

const engineDecisionMap = new Map();

engineDecisions.forEach(row => {
  const name = normalizeLabEngineName(row.poi_name);
  if (name) {
    engineDecisionMap.set(name, row);
  }
});

  if (!engineDecisions.length && !dictionary.length && !rules.length) {
  console.log("LabEngine Brainは空です。既存のLabEngine分類だけで続行します。");
  return points;
}

let engineDecisionMatchedCount = 0;
let dictionaryMatchedCount = 0;
let ruleMatchedCount = 0;

  const enrichedPoints = (points || []).map(point => {
    const name = getLabEnginePointName(point);
    
const engineDecision =
  engineDecisionMap.get(normalizeLabEngineName(name));

if (engineDecision) {
  engineDecisionMatchedCount += 1;

  const category = convertLabEngineCategoryKey(engineDecision.final_category);

  return {
    ...point,
    _labCategoryKey: category.key,
    _labCategoryLabel: category.label,
    _labEngineBrainMatched: true,
    _labEngineBrainSource: "campsite_poi_engine_decisions_v1",
    _labEngineName: engineDecision.poi_name || "",
    _labEngineAction: engineDecision.final_status || "",
    _labEngineReasonCode: engineDecision.decision_basis || "",
    _labEngineConfidenceScore: 1,
    _labEngineFinalReason: engineDecision.final_reason || "",
    _labEngineRuleTitle: engineDecision.rule_title || ""
  };
}
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
  `LabEngine Brain分類: 最終判定${engineDecisionMatchedCount}件 / 辞書${dictionaryMatchedCount}件 / 推論${ruleMatchedCount}件 / 全${points.length}件`
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
  engineDecisionHit: 0,
  dictionaryHit: 0,
  inferenceRuleHit: 0,
  unmatched: 0,
    totalJudged: 0,
    dictionaryLoadOk: false,
    ruleLoadOk: false,
    lastError: ""
  };

  function reset() {
  state.engineDecisionHit = 0;
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
const isEngineDecisionMatch =
  source.includes("campsite_poi_engine_decisions_v1") ||
  !!result?._labEngineFinalReason ||
  !!result?._labEngineRuleTitle;

  if (isEngineDecisionMatch) {
  state.engineDecisionHit += 1;
  return;
}

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
   const learningHit =
  state.engineDecisionHit +
  state.dictionaryHit +
  state.inferenceRuleHit;

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
  engineDecisionHit: state.engineDecisionHit,
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