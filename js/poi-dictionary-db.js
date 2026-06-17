let poiDatabankCache = null;

function normalizePoiText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[・･\-_ー－]/g, "");
}

async function loadPoiDatabank() {
  if (poiDatabankCache) {
    return poiDatabankCache;
  }

  if (!window.campsiteSupabase) {
    alert("Supabaseクライアントが未初期化です。lab-supabase.jsを確認してください。");
    console.error("window.campsiteSupabase is not defined");
    return null;
  }

  const [categories, dictionaries, aliases, rules] = await Promise.all([
  window.campsiteSupabase
    .from("category_master")
    .select("*"),

  window.campsiteSupabase
    .from("dictionary_master")
    .select("*"),

  window.campsiteSupabase
    .from("alias_master")
    .select("*"),

  window.campsiteSupabase
    .from("review_rules")
    .select("*")
]);

  const errors = [categories, dictionaries, aliases, rules].filter(result => result.error);

  if (errors.length > 0) {
    console.error("POI名称データバンク読込エラー:", errors);
    alert("Supabase接続に失敗しました。Consoleを確認してください。");
    return null;
  }

  poiDatabankCache = {
  categories: (categories.data || []).filter(item => item.active !== false),
  dictionaries: (dictionaries.data || []).filter(item => item.active !== false),
  aliases: (aliases.data || []).filter(item => item.active !== false),
  rules: (rules.data || []).filter(item => item.active !== false)
};

  console.log("POI名称データバンク読込成功:", poiDatabankCache);

  return poiDatabankCache;
}

function getCategoryById(databank, categoryId) {
  return databank.categories.find(category => category.category_id === categoryId) || null;
}

function sortDictionaryCandidates(items) {
  return [...items].sort((a, b) => {
    const priorityA = Number(a.priority ?? 999);
    const priorityB = Number(b.priority ?? 999);

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    const nameA = String(a.normalized_name || a.canonical_name || "");
    const nameB = String(b.normalized_name || b.canonical_name || "");

    return nameB.length - nameA.length;
  });
}

function findDictionaryById(databank, dictionaryId) {
  return databank.dictionaries.find(item => item.dictionary_id === dictionaryId) || null;
}

function findAliasMatch(databank, normalizedPoiName) {
  const candidates = databank.aliases
    .map(alias => {
      const aliasText = normalizePoiText(alias.normalized_alias || alias.alias_name);
      return {
        alias,
        aliasText
      };
    })
    .filter(item => item.aliasText && normalizedPoiName.includes(item.aliasText))
    .sort((a, b) => b.aliasText.length - a.aliasText.length);

  if (candidates.length === 0) {
    return null;
  }

  const matchedAlias = candidates[0].alias;
  const dictionary = findDictionaryById(databank, matchedAlias.dictionary_id);

  if (!dictionary) {
    return null;
  }

  return {
    matchedBy: "alias",
    alias: matchedAlias,
    dictionary
  };
}

function findDictionaryMatch(databank, normalizedPoiName) {
  const candidates = sortDictionaryCandidates(databank.dictionaries)
    .map(dictionary => {
      const normalizedName = normalizePoiText(dictionary.normalized_name || dictionary.canonical_name);
      return {
        dictionary,
        normalizedName
      };
    })
    .filter(item => item.normalizedName && normalizedPoiName.includes(item.normalizedName));

  if (candidates.length === 0) {
    return null;
  }

  return {
    matchedBy: "dictionary",
    dictionary: candidates[0].dictionary
  };
}

async function classifyPoiName(poiName) {
  const databank = await loadPoiDatabank();

  if (!databank) {
    return {
      poiName,
      categoryId: "UNKNOWN",
      categoryName: "未分類",
      matched: false,
      matchedBy: "none",
      dictionaryId: null,
      canonicalName: null,
      reportTag: "UNKNOWN",
      riskTag: null,
      reportPhrase: "POI名称データバンクを読み込めませんでした。"
    };
  }

  const normalizedPoiName = normalizePoiText(poiName);

  const aliasMatch = findAliasMatch(databank, normalizedPoiName);
  const dictionaryMatch = aliasMatch || findDictionaryMatch(databank, normalizedPoiName);

  if (!dictionaryMatch) {
    return {
      poiName,
      normalizedPoiName,
      categoryId: "UNKNOWN",
      categoryName: "未分類",
      matched: false,
      matchedBy: "none",
      dictionaryId: null,
      canonicalName: null,
      reportTag: "UNKNOWN",
      riskTag: null,
      reportPhrase: "辞書未一致です。必要に応じてレビュー候補にします。"
    };
  }

  const dictionary = dictionaryMatch.dictionary;
  const category = getCategoryById(databank, dictionary.category_id);

  return {
    poiName,
    normalizedPoiName,
    categoryId: dictionary.category_id || "UNKNOWN",
    categoryName: category?.category_name || dictionary.category_id || "未分類",
    categoryGroup: category?.category_group || null,
    matched: true,
    matchedBy: dictionaryMatch.matchedBy,
    dictionaryId: dictionary.dictionary_id,
    canonicalName: dictionary.canonical_name,
    reportTag: dictionary.report_tag || null,
    riskTag: dictionary.risk_tag || null,
    reportPhrase: dictionary.report_phrase || "",
    scoreWeight: Number(dictionary.score_weight ?? 0),
    rawDictionary: dictionary,
    rawCategory: category,
    rawAlias: dictionaryMatch.alias || null
  };
}

async function classifyPoiNames(poiNames) {
  const results = [];

  for (const poiName of poiNames) {
    results.push(await classifyPoiName(poiName));
  }

  return results;
}

async function testLoadPoiDatabank() {
  const databank = await loadPoiDatabank();

  if (!databank) return;

  alert(
    "POI名称データバンク読込成功\n" +
    `category_master: ${databank.categories.length}件\n` +
    `dictionary_master: ${databank.dictionaries.length}件\n` +
    `alias_master: ${databank.aliases.length}件\n` +
    `review_rules: ${databank.rules.length}件`
  );
}

async function testClassifyPoiNames() {
  const sampleNames = [
    "木製ベンチ",
    "上野公園トイレ",
    "噴水広場",
    "公園入口",
    "第一駐車場",
    "桜の園"
  ];

  const results = await classifyPoiNames(sampleNames);

  console.table(results);

  const message = results
    .map(result => {
      const mark = result.matched ? "✅" : "⚪";
      return `${mark} ${result.poiName} → ${result.categoryId} / ${result.canonicalName || "未一致"}`;
    })
    .join("\n");

  alert("POI分類テスト結果\n\n" + message);
}


function convertPoiCategoryToLabKey(categoryId) {
  switch (categoryId) {
    case "REST":
    case "SAFE":
      return "rest";

    case "STAY":
    case "SPORT":
    case "FAM":
      return "stay";

    case "LOOP":
    case "TRANSIT":
    case "DISC":
    case "NATURE":
      return "loop";

    case "STAY_RISK":
    case "FLOW_RISK":
      return "caution";

    default:
      return "unknown";
  }
}

function convertPoiCategoryToLabLabel(categoryId) {
  const labels = {
    REST: "休憩",
    SAFE: "休憩・支援",
    STAY: "滞在",
    SPORT: "運動",
    FAM: "親子",
    LOOP: "回遊",
    TRANSIT: "アクセス",
    DISC: "発見・文化",
    NATURE: "自然",
    STAY_RISK: "注意",
    FLOW_RISK: "注意",
    UNKNOWN: "未分類"
  };

  return labels[categoryId] || "未分類";
}

async function enrichLabPointsWithPoiDatabank(points) {
  const enriched = [];

  for (const point of points) {
    const poiName =
      point.name ||
      point.title ||
      point.poi_name ||
      "";

    const classification =
      await classifyPoiName(poiName);

    const categoryId =
      classification?.categoryId || "UNKNOWN";

    enriched.push({
      ...point,
      _poiClassification: classification,
      _labCategoryKey: convertPoiCategoryToLabKey(categoryId),
      _labCategoryLabel: convertPoiCategoryToLabLabel(categoryId),
      _labCanonicalName: classification?.canonicalName || null,
      _labRiskTag: classification?.riskTag || null,
      _labReportPhrase: classification?.reportPhrase || null
    });
  }

  return enriched;
}
window.loadPoiDatabank = loadPoiDatabank;
window.classifyPoiName = classifyPoiName;
window.classifyPoiNames = classifyPoiNames;
window.testLoadPoiDatabank = testLoadPoiDatabank;
window.testClassifyPoiNames = testClassifyPoiNames;
window.enrichLabPointsWithPoiDatabank = enrichLabPointsWithPoiDatabank;
window.convertPoiCategoryToLabKey = convertPoiCategoryToLabKey;
window.convertPoiCategoryToLabLabel = convertPoiCategoryToLabLabel;