/* ======================================================
   UI大改修 11: Campsite知見基盤

   目的:
   - 利用者向けアドバイスを「必須確認 / 推奨」に分ける
   - 管理者が実際のKMZを確認して得た観察は、未公開データとして蓄積できる形にする
   - 同じ傾向が繰り返し確認できたものだけ、管理者判断で「推奨」へ昇格する
   - AIの自由生成ではなく、登録済みの説明可能なデータだけを表示する
====================================================== */

const CAMPSITE_KNOWLEDGE_SCHEMA_VERSION = "1.1";

const CAMPSITE_ADVICE_LEVELS = Object.freeze({
  REQUIRED: "required",
  RECOMMENDED: "recommended"
});

const CAMPSITE_ADVICE_LEVEL_LABELS = Object.freeze({
  [CAMPSITE_ADVICE_LEVELS.REQUIRED]: "必須確認",
  [CAMPSITE_ADVICE_LEVELS.RECOMMENDED]: "推奨"
});

const CAMPSITE_KNOWLEDGE_SOURCE_TYPES = Object.freeze({
  FIXED_RULE: "fixed_rule",
  KMZ_REVIEW: "kmz_review"
});

const CAMPSITE_KNOWLEDGE_REQUIRED_FIELDS = Object.freeze([
  "id",
  "level",
  "category",
  "targetCondition",
  "advice",
  "importance",
  "evidence",
  "sourceType",
  "sourceRef",
  "confirmedAt",
  "regionalVariation",
  "publicationAllowed"
]);

const CAMPSITE_REVIEW_OBSERVATION_REQUIRED_FIELDS = Object.freeze([
  "id",
  "category",
  "observation",
  "evidence",
  "sourceType",
  "sourceRef",
  "confirmedAt",
  "regionalVariation",
  "promotionStatus"
]);

const CAMPSITE_REVIEW_PROMOTION_STATUS = Object.freeze({
  CANDIDATE: "candidate",
  PROMOTED: "promoted",
  REJECTED: "rejected"
});

/*
  利用者へ表示してよい固定ルール・推奨事項。
  現在のCampsite Design Toolで既に案内している方針に限定する。
*/
const CAMPSITE_FIXED_KNOWLEDGE = Object.freeze([
  {
    id: "required-distance-basic-40m",
    level: CAMPSITE_ADVICE_LEVELS.REQUIRED,
    category: "distance",
    targetCondition: { type: "always" },
    advice: "POI間隔は40mを基本とし、40mの確保が難しい場所だけ30m以上40m未満を調整候補として確認します。",
    importance: 3,
    evidence: "Campsite Design Toolの距離チェック・設計ガイドで使用している基本距離方針。",
    sourceType: CAMPSITE_KNOWLEDGE_SOURCE_TYPES.FIXED_RULE,
    sourceRef: "campsite-design-tool",
    confirmedAt: "2026-08-10",
    regionalVariation: false,
    publicationAllowed: true
  },
  {
    id: "required-added-poi-limit-25",
    level: CAMPSITE_ADVICE_LEVELS.REQUIRED,
    category: "poi-count",
    targetCondition: { type: "addedPoiCount", operator: ">", value: 25 },
    advice: "追加POIは25個以内に収まっているか確認します。",
    importance: 3,
    evidence: "Campsite Design Toolの設計ガイド・提出前チェックで使用している上限確認。",
    sourceType: CAMPSITE_KNOWLEDGE_SOURCE_TYPES.FIXED_RULE,
    sourceRef: "campsite-design-tool",
    confirmedAt: "2026-08-10",
    regionalVariation: false,
    publicationAllowed: true
  },
  {
    id: "required-layer-separation",
    level: CAMPSITE_ADVICE_LEVELS.REQUIRED,
    category: "layer",
    targetCondition: { type: "layerSeparation" },
    advice: "既存POI・追加POI・活動範囲は、確認しやすいようにレイヤーを分けます。",
    importance: 3,
    evidence: "距離チェックと提出前チェックで必要になるレイヤー構成。",
    sourceType: CAMPSITE_KNOWLEDGE_SOURCE_TYPES.FIXED_RULE,
    sourceRef: "campsite-design-tool",
    confirmedAt: "2026-08-10",
    regionalVariation: false,
    publicationAllowed: true
  },
  {
    id: "recommended-traffic-flow",
    level: CAMPSITE_ADVICE_LEVELS.RECOMMENDED,
    category: "traffic",
    targetCondition: { type: "siteCondition", key: "traffic" },
    advice: "人の流れを妨げにくい位置へ、立ち止まるポイントを分散して配置することを推奨します。",
    importance: 2,
    evidence: "現地環境チェックで確認している通行・滞留への配慮。",
    sourceType: CAMPSITE_KNOWLEDGE_SOURCE_TYPES.FIXED_RULE,
    sourceRef: "campsite-design-tool",
    confirmedAt: "2026-08-10",
    regionalVariation: true,
    publicationAllowed: true
  },
  {
    id: "recommended-loop-route",
    level: CAMPSITE_ADVICE_LEVELS.RECOMMENDED,
    category: "route",
    targetCondition: { type: "siteCondition", key: "loopRoute" },
    advice: "一か所への集中を避けられるよう、回遊できる動線を意識することを推奨します。",
    importance: 2,
    evidence: "作成前の拠点診断・現地環境チェックで確認している回遊性。",
    sourceType: CAMPSITE_KNOWLEDGE_SOURCE_TYPES.FIXED_RULE,
    sourceRef: "campsite-design-tool",
    confirmedAt: "2026-08-10",
    regionalVariation: true,
    publicationAllowed: true
  },
  {
    id: "recommended-waiting-space",
    level: CAMPSITE_ADVICE_LEVELS.RECOMMENDED,
    category: "waiting",
    targetCondition: { type: "siteCondition", key: "waitingSpace" },
    advice: "集合・待機場所は、通行の余白を残せる場所として設計へ組み込むことを推奨します。",
    importance: 2,
    evidence: "作成前の拠点診断・現地環境チェックで確認している待機環境。",
    sourceType: CAMPSITE_KNOWLEDGE_SOURCE_TYPES.FIXED_RULE,
    sourceRef: "campsite-design-tool",
    confirmedAt: "2026-08-10",
    regionalVariation: true,
    publicationAllowed: true
  }
]);

/*
  管理者がデータベースから実際のKMZを確認して見つけた傾向を置く内部用の箱。
  ここに入った時点では利用者へ表示しない。
  同じ傾向が複数のKMZで繰り返し確認できた場合だけ、管理者判断で
  CAMPSITE_FIXED_KNOWLEDGE の recommended 項目へ昇格させる。
*/
const CAMPSITE_KMZ_REVIEW_OBSERVATIONS = [];

function validateCampsiteKnowledgeEntry(entry) {
  const errors = [];

  if (!entry || typeof entry !== "object") {
    return ["知見データがオブジェクトではありません。"];
  }

  CAMPSITE_KNOWLEDGE_REQUIRED_FIELDS.forEach(field => {
    if (!(field in entry)) errors.push(`必須項目がありません: ${field}`);
  });

  if (!Object.values(CAMPSITE_ADVICE_LEVELS).includes(entry.level)) {
    errors.push(`levelが不正です: ${entry.level}`);
  }

  if (![1, 2, 3].includes(entry.importance)) {
    errors.push("importanceは1〜3で指定してください。");
  }

  if (!Object.values(CAMPSITE_KNOWLEDGE_SOURCE_TYPES).includes(entry.sourceType)) {
    errors.push(`sourceTypeが不正です: ${entry.sourceType}`);
  }

  if (typeof entry.regionalVariation !== "boolean") {
    errors.push("regionalVariationはbooleanで指定してください。");
  }

  if (typeof entry.publicationAllowed !== "boolean") {
    errors.push("publicationAllowedはbooleanで指定してください。");
  }

  return errors;
}

function validateCampsiteReviewObservation(entry) {
  const errors = [];

  if (!entry || typeof entry !== "object") {
    return ["KMZレビュー観察データがオブジェクトではありません。"];
  }

  CAMPSITE_REVIEW_OBSERVATION_REQUIRED_FIELDS.forEach(field => {
    if (!(field in entry)) errors.push(`必須項目がありません: ${field}`);
  });

  if (entry.sourceType !== CAMPSITE_KNOWLEDGE_SOURCE_TYPES.KMZ_REVIEW) {
    errors.push("KMZレビュー観察のsourceTypeはkmz_reviewで指定してください。");
  }

  if (!Object.values(CAMPSITE_REVIEW_PROMOTION_STATUS).includes(entry.promotionStatus)) {
    errors.push(`promotionStatusが不正です: ${entry.promotionStatus}`);
  }

  if (typeof entry.regionalVariation !== "boolean") {
    errors.push("regionalVariationはbooleanで指定してください。");
  }

  return errors;
}

function getCampsiteKnowledgeEntries(options = {}) {
  const {
    level = null,
    category = null,
    publicationAllowedOnly = true
  } = options;

  return CAMPSITE_FIXED_KNOWLEDGE.filter(entry => {
    if (validateCampsiteKnowledgeEntry(entry).length) return false;
    if (level && entry.level !== level) return false;
    if (category && entry.category !== category) return false;
    if (publicationAllowedOnly && !entry.publicationAllowed) return false;
    return true;
  });
}

function getCampsiteKnowledgeLevelLabel(level) {
  return CAMPSITE_ADVICE_LEVEL_LABELS[level] || "未分類";
}

function ensureCampsiteKnowledgeStyles() {
  if (document.getElementById("campsiteKnowledgeStyles")) return;

  const style = document.createElement("style");
  style.id = "campsiteKnowledgeStyles";
  style.textContent = `
    #site-diagnosis .knowledge-level-guide {
      margin: 0 0 16px;
      padding: 14px 16px;
      border: 1px solid rgba(148,163,184,.24);
      border-radius: 14px;
      background: rgba(15,23,42,.58);
      color: #cbd5e1;
      font-size: 12px;
      line-height: 1.75;
    }

    #site-diagnosis .knowledge-level-guide strong {
      color: #f8fafc;
    }

    .knowledge-level-badge {
      display: inline-flex;
      align-items: center;
      margin-right: 7px;
      padding: 2px 7px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 900;
      line-height: 1.45;
      vertical-align: .08em;
      white-space: nowrap;
    }

    .knowledge-level-badge.required {
      border: 1px solid rgba(239,68,68,.42);
      background: rgba(239,68,68,.14);
      color: #fecaca;
    }

    .knowledge-level-badge.recommended {
      border: 1px solid rgba(56,189,248,.38);
      background: rgba(56,189,248,.12);
      color: #bae6fd;
    }
  `;

  document.head.appendChild(style);
}

function addKnowledgeLevelGuideToSiteDiagnosis() {
  const section = document.getElementById("site-diagnosis");
  const policy = section?.querySelector(".site-diagnosis-policy");
  if (!section || !policy || section.querySelector(".knowledge-level-guide")) return;

  const guide = document.createElement("div");
  guide.className = "knowledge-level-guide";
  guide.innerHTML = `
    <strong>アドバイスは2種類に分けて扱います。</strong><br>
    <span class="knowledge-level-badge required">必須確認</span>距離・追加POI上限・レイヤー分けなど、提出前に必ず確認する項目。<br>
    <span class="knowledge-level-badge recommended">推奨</span>回遊・待機・通行など、現地条件に合わせて考える項目。
  `;

  policy.insertAdjacentElement("afterend", guide);
}

function getVisibleDiagnosisAdviceLevel(text) {
  const normalized = String(text || "");

  if (/40m|30m|25個|レイヤー/.test(normalized)) {
    return CAMPSITE_ADVICE_LEVELS.REQUIRED;
  }

  return CAMPSITE_ADVICE_LEVELS.RECOMMENDED;
}

function decorateSiteDiagnosisAdvice() {
  const result = document.getElementById("siteDiagnosisResult");
  if (!result) return;

  result.querySelectorAll(
    ".site-diagnosis-result-card.check li, .site-diagnosis-result-card.design li"
  ).forEach(item => {
    if (item.querySelector(":scope > .knowledge-level-badge")) return;

    const level = getVisibleDiagnosisAdviceLevel(item.textContent);
    const badge = document.createElement("span");
    badge.className = `knowledge-level-badge ${level}`;
    badge.textContent = getCampsiteKnowledgeLevelLabel(level);
    item.prepend(badge);
  });
}

function refreshCampsiteKnowledgeUi() {
  addKnowledgeLevelGuideToSiteDiagnosis();
  decorateSiteDiagnosisAdvice();
}

function setupCampsiteKnowledgeUi() {
  ensureCampsiteKnowledgeStyles();
  refreshCampsiteKnowledgeUi();

  const section = document.getElementById("site-diagnosis");
  if (!section || section.dataset.knowledgeObserverReady === "true") return;

  section.dataset.knowledgeObserverReady = "true";
  const observer = new MutationObserver(() => {
    requestAnimationFrame(refreshCampsiteKnowledgeUi);
  });

  observer.observe(section, { childList: true, subtree: true });
}

window.CampsiteKnowledge = Object.freeze({
  schemaVersion: CAMPSITE_KNOWLEDGE_SCHEMA_VERSION,
  levels: CAMPSITE_ADVICE_LEVELS,
  sourceTypes: CAMPSITE_KNOWLEDGE_SOURCE_TYPES,
  reviewPromotionStatus: CAMPSITE_REVIEW_PROMOTION_STATUS,
  requiredFields: CAMPSITE_KNOWLEDGE_REQUIRED_FIELDS,
  reviewObservationRequiredFields: CAMPSITE_REVIEW_OBSERVATION_REQUIRED_FIELDS,
  fixedEntries: CAMPSITE_FIXED_KNOWLEDGE,
  reviewObservations: CAMPSITE_KMZ_REVIEW_OBSERVATIONS,
  validateEntry: validateCampsiteKnowledgeEntry,
  validateReviewObservation: validateCampsiteReviewObservation,
  getEntries: getCampsiteKnowledgeEntries,
  getLevelLabel: getCampsiteKnowledgeLevelLabel
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupCampsiteKnowledgeUi);
} else {
  setupCampsiteKnowledgeUi();
}
