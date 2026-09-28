(() => {
  'use strict';

  const DEFAULT_BASE = 'data/distance-advice';
  let cachedDataPromise = null;

  const asFiniteNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };

  function deriveContext(input = {}) {
    const existingPoiCount = Math.max(0, Math.trunc(asFiniteNumber(input.existing_poi_count) ?? 0));
    const under50Count = Math.max(0, Math.trunc(asFiniteNumber(input.under50_count) ?? 0));
    const under20Count = Math.max(0, Math.trunc(asFiniteNumber(input.under20_count) ?? 0));
    const between20_30Count = Math.max(0, Math.trunc(asFiniteNumber(input.between20_30_count) ?? 0));
    const between30_50Count = Math.max(0, Math.trunc(asFiniteNumber(input.between30_50_count) ?? 0));
    const ratio = (count) => under50Count > 0 ? count / under50Count : 0;
    const under20Ratio = ratio(under20Count);
    const between20_30Ratio = ratio(between20_30Count);
    const between30_50Ratio = ratio(between30_50Count);

    let densityTag = 'NO_CLOSE';
    if (under50Count >= 1 && under50Count <= 3) {
      densityTag = 'FEW_CLOSE';
    } else if (under50Count >= 4) {
      const bands = [
        ['VERY_CLOSE_HEAVY', under20Ratio],
        ['MID_CLOSE_HEAVY', between20_30Ratio],
        ['WIDE_CLOSE_HEAVY', between30_50Ratio],
      ].filter(([, value]) => value >= 0.45);
      densityTag = bands.length === 1 ? bands[0][0] : 'MIXED_CLOSE';
    }

    const featureTags = [];
    if (under50Count >= 4 && existingPoiCount > 0 && under50Count / existingPoiCount >= 0.5) {
      featureTags.push('CLOSE_MANY');
    }

    const groupSize = asFiniteNumber(input.group_size);
    const clusterLength = asFiniteNumber(input.cluster_length_m);
    const expectedStops = asFiniteNumber(input.expected_stop_points);

    let groupTag = null;
    if (groupSize !== null && groupSize >= 1) {
      groupTag = groupSize <= 10 ? 'GROUP_SMALL' : groupSize <= 29 ? 'GROUP_MID' : 'GROUP_LARGE';
    }

    let clusterTag = null;
    if (clusterLength !== null && clusterLength > 0) {
      clusterTag = clusterLength <= 100 ? 'CLUSTER_COMPACT' : clusterLength <= 180 ? 'CLUSTER_MID' : 'CLUSTER_SPREAD';
    }

    let stopTag = null;
    if (expectedStops !== null && expectedStops >= 0) {
      stopTag = expectedStops <= 2 ? 'STOP_LOW' : expectedStops <= 4 ? 'STOP_MID' : 'STOP_HIGH';
    }

    return {
      existing_poi_count: existingPoiCount,
      under50_count: under50Count,
      under20_count: under20Count,
      between20_30_count: between20_30Count,
      between30_50_count: between30_50Count,
      under20_ratio: under20Ratio,
      between20_30_ratio: between20_30Ratio,
      between30_50_ratio: between30_50Ratio,
      traffic: input.traffic ?? null,
      plaza: typeof input.plaza === 'boolean' ? input.plaza : null,
      circulation: typeof input.circulation === 'boolean' ? input.circulation : null,
      waiting: typeof input.waiting === 'boolean' ? input.waiting : null,
      group_size: groupSize,
      cluster_length_m: clusterLength,
      expected_stop_points: expectedStops,
      density_tag: densityTag,
      feature_tags: featureTags,
      group_tag: groupTag,
      cluster_tag: clusterTag,
      stop_tag: stopTag,
    };
  }

  function matches(rule, context) {
    return Object.entries(rule.when || {}).every(([key, expected]) => {
      if (key === 'feature_tags') {
        return Array.isArray(expected) && expected.every((tag) => context.feature_tags.includes(tag));
      }
      return context[key] === expected;
    });
  }

  function conflictPairs(ruleset) {
    return ruleset?.selection_policy?.conflict_behavior_pairs || [];
  }

  function hasConflict(candidate, selected, ruleset) {
    const candidateTags = new Set(candidate.behavior_tags || []);
    return selected.some((current) => {
      const currentTags = new Set(current.behavior_tags || []);
      return conflictPairs(ruleset).some(([a, b]) => (
        (candidateTags.has(a) && currentTags.has(b)) ||
        (candidateTags.has(b) && currentTags.has(a))
      ));
    });
  }

  function stableHash(text) {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function stableSeed(context, seed) {
    if (seed !== undefined && seed !== null && String(seed).length > 0) return String(seed);
    const ordered = {};
    Object.keys(context).sort().forEach((key) => { ordered[key] = context[key]; });
    return JSON.stringify(ordered);
  }

  function normalizeData(data) {
    if (!data?.ruleset || !data?.level2 || !data?.level3 || !data?.level4 || !data?.singles) {
      throw new Error('Distance advice rule data is incomplete.');
    }
    const compoundRules = [
      ...data.level2.rules.map((rule) => ({ ...rule, level: 2 })),
      ...data.level3.rules.map((rule) => ({ ...rule, level: 3 })),
      ...data.level4.rules.map((rule) => ({ ...rule, level: 4 })),
    ];
    return { ...data, compoundRules };
  }

  function selectCompound(context, data) {
    const maxOutput = data.ruleset.selection_policy.max_output ?? 3;
    const matched = data.compoundRules.filter((rule) => matches(rule, context));
    const ordered = [...matched].sort((a, b) => (
      b.priority - a.priority || b.level - a.level || a.id.localeCompare(b.id)
    ));
    const selected = [];
    const usedCategories = new Set();
    for (const rule of ordered) {
      if (usedCategories.has(rule.category)) continue;
      if (hasConflict(rule, selected, data.ruleset)) continue;
      selected.push(rule);
      usedCategories.add(rule.category);
      if (selected.length >= maxOutput) break;
    }
    return { matched, selected };
  }

  function selectFallbacks(context, selected, data, seed) {
    const maxOutput = data.ruleset.selection_policy.max_output ?? 3;
    if (selected.length >= maxOutput) return [];
    const usedCategories = new Set(selected.map((item) => item.category));
    const byCategory = new Map();
    for (const comment of data.singles.comments || []) {
      if (usedCategories.has(comment.category) || !matches(comment, context)) continue;
      if (!byCategory.has(comment.category)) byCategory.set(comment.category, []);
      byCategory.get(comment.category).push(comment);
    }

    const baseSeed = stableSeed(context, seed);
    const candidates = [];
    for (const [category, comments] of byCategory.entries()) {
      comments.sort((a, b) => a.id.localeCompare(b.id));
      const index = stableHash(`${baseSeed}:${category}`) % comments.length;
      candidates.push(comments[index]);
    }
    candidates.sort((a, b) => a.category.localeCompare(b.category) || a.id.localeCompare(b.id));
    return candidates.slice(0, maxOutput - selected.length);
  }

  function toOutput(item) {
    return {
      id: item.id,
      level: item.level ?? 1,
      category: item.category,
      priority: item.priority,
      advice: item.advice,
      facts_used: [...(item.facts_used || [])],
      behavior_tags: [...(item.behavior_tags || [])],
    };
  }

  function evaluateWithData(input, rawData, options = {}) {
    const data = rawData.compoundRules ? rawData : normalizeData(rawData);
    const context = deriveContext(input);
    const requiredSiteFactsComplete = (
      ['easy', 'narrow', 'careful'].includes(context.traffic) &&
      typeof context.plaza === 'boolean' &&
      typeof context.circulation === 'boolean' &&
      typeof context.waiting === 'boolean'
    );

    if (!requiredSiteFactsComplete) {
      return {
        status: 'site_confirmation_required',
        context,
        advice: [],
        matched_rule_ids: [],
        chairman_message: '見てこないとだめだよ❗️\n現地へGO‼️',
      };
    }

    const { matched, selected } = selectCompound(context, data);
    const fallbacks = selectFallbacks(context, selected, data, options.seed);
    const advice = [...selected.map(toOutput), ...fallbacks.map(toOutput)];
    return {
      status: 'ready',
      context,
      advice,
      matched_rule_ids: matched.map((rule) => rule.id),
      compound_rule_ids: selected.map((rule) => rule.id),
      fallback_ids: fallbacks.map((rule) => rule.id),
    };
  }

  async function loadRuleData(baseUrl = DEFAULT_BASE) {
    const root = String(baseUrl).replace(/\/$/, '');
    const load = async (name) => {
      const response = await fetch(`${root}/${name}`, { cache: 'no-store', credentials: 'same-origin' });
      if (!response.ok) throw new Error(`Distance advice data load failed: ${name} (${response.status})`);
      return response.json();
    };
    const [ruleset, level2, level3, level4, singles] = await Promise.all([
      load('ruleset-v0.1.json'),
      load('rules-level2-v0.1.json'),
      load('rules-level3-v0.1.json'),
      load('rules-level4-v0.1.json'),
      load('single-comments-v0.1.json'),
    ]);
    return normalizeData({ ruleset, level2, level3, level4, singles });
  }

  async function evaluate(input, options = {}) {
    if (!cachedDataPromise || options.reload === true) cachedDataPromise = loadRuleData(options.baseUrl || DEFAULT_BASE);
    const data = await cachedDataPromise;
    return evaluateWithData(input, data, options);
  }

  globalThis.CampsiteDistanceAdvice = Object.freeze({
    deriveContext,
    evaluate,
    evaluateWithData,
    loadRuleData,
    normalizeData,
  });
})();
