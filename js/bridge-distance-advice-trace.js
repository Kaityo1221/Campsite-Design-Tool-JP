(() => {
  'use strict';

  const PROJECT_KEY = 'campsiteProject.v1';
  const TRACE_VERSION = '0.1.0';
  const RULESET_ID = 'campsite-distance-advice-v0.1';
  let timer = 0;
  let running = false;

  function readProject() {
    try { return JSON.parse(sessionStorage.getItem(PROJECT_KEY) || 'null'); }
    catch (_) { return null; }
  }

  function writeProject(project) {
    sessionStorage.setItem(PROJECT_KEY, JSON.stringify(project));
  }

  function sameProject(a, b) {
    return Boolean(
      a &&
      b &&
      a.source === 'bridge' &&
      b.source === 'bridge' &&
      String(a.projectId || '') &&
      String(a.projectId || '') === String(b.projectId || '')
    );
  }

  function latestProjectFor(project) {
    const latest = readProject();
    return sameProject(latest, project) ? latest : project;
  }

  function writeAdviceResult(project, distanceAdviceResult) {
    const target = latestProjectFor(project);
    target.distanceAdviceResult = distanceAdviceResult;
    writeProject(target);
    return target;
  }

  function roleOf(poi) {
    if (poi?.role === 'added' || String(poi?.layer || '').startsWith('new-')) return 'added';
    return 'existing';
  }

  function pointOf(poi) {
    const lat = Number(poi?.lat);
    const lng = Number(poi?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, role: roleOf(poi) };
  }

  function distanceMeters(a, b) {
    const R = 6371000;
    const lat1 = a.lat * Math.PI / 180;
    const lat2 = b.lat * Math.PI / 180;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const q = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q));
  }

  function environmentOf(project) {
    const source = project?.siteEnvironment || {};
    return {
      traffic: ['easy', 'narrow', 'careful'].includes(source.traffic) ? source.traffic : null,
      plaza: typeof source.plaza === 'boolean' ? source.plaza : null,
      circulation: typeof source.circulation === 'boolean' ? source.circulation : null,
      waiting: typeof source.waiting === 'boolean' ? source.waiting : null,
    };
  }

  function environmentComplete(env) {
    return Boolean(
      env.traffic &&
      typeof env.plaza === 'boolean' &&
      typeof env.circulation === 'boolean' &&
      typeof env.waiting === 'boolean'
    );
  }

  function adviceInput(project) {
    const points = (Array.isArray(project?.currentPois) ? project.currentPois : []).map(pointOf).filter(Boolean);
    const existing = points.filter((point) => point.role === 'existing');
    const bands = { under20: 0, between20_30: 0, between30_50: 0 };
    let under50 = 0;

    for (let i = 0; i < existing.length; i += 1) {
      for (let j = i + 1; j < existing.length; j += 1) {
        const distance = distanceMeters(existing[i], existing[j]);
        if (distance >= 50) continue;
        under50 += 1;
        if (distance < 20) bands.under20 += 1;
        else if (distance < 30) bands.between20_30 += 1;
        else bands.between30_50 += 1;
      }
    }

    const env = environmentOf(project);
    return {
      env,
      input: {
        existing_poi_count: existing.length,
        under50_count: under50,
        under20_count: bands.under20,
        between20_30_count: bands.between20_30,
        between30_50_count: bands.between30_50,
        traffic: env.traffic,
        plaza: env.plaza,
        circulation: env.circulation,
        waiting: env.waiting,
        group_size: project?.distanceAdviceContext?.group_size ?? null,
        cluster_length_m: project?.distanceAdviceContext?.cluster_length_m ?? null,
        expected_stop_points: project?.distanceAdviceContext?.expected_stop_points ?? null,
      },
    };
  }

  function stablePayload(trace) {
    return JSON.stringify({
      rulesetId: trace.rulesetId,
      designSignature: trace.designSignature,
      context: trace.context,
      matchedRuleIds: trace.matchedRuleIds,
      selectedCompoundRuleIds: trace.selectedCompoundRuleIds,
      fallbackIds: trace.fallbackIds,
      shownAdvice: trace.shownAdvice,
    });
  }

  function markStale(project) {
    const latest = latestProjectFor(project);
    const existing = latest?.distanceAdviceResult;
    if (!existing || existing.stale === true) return false;
    writeAdviceResult(latest, {
      ...existing,
      status: 'stale',
      stale: true,
      staleAt: new Date().toISOString(),
    });
    return true;
  }

  async function syncTrace() {
    if (running) return;
    const project = readProject();
    if (!project || project.source !== 'bridge') return;

    if (project?.distanceResult?.stale === true) {
      markStale(project);
      return;
    }

    const { env, input } = adviceInput(project);
    if (!environmentComplete(env) || !globalThis.CampsiteDistanceAdvice) return;

    running = true;
    try {
      const output = await globalThis.CampsiteDistanceAdvice.evaluate(input, {
        seed: project?.distanceResult?.designSignature || project?.projectId || '',
      });
      if (output.status !== 'ready' || !Array.isArray(output.advice) || output.advice.length === 0) return;

      const trace = {
        schemaVersion: TRACE_VERSION,
        rulesetId: RULESET_ID,
        status: 'ready',
        stale: false,
        generatedAt: new Date().toISOString(),
        designSignature: project?.distanceResult?.designSignature || null,
        context: output.context,
        matchedRuleIds: [...(output.matched_rule_ids || [])],
        selectedCompoundRuleIds: [...(output.compound_rule_ids || [])],
        fallbackIds: [...(output.fallback_ids || [])],
        shownAdvice: output.advice.map((item) => ({
          id: item.id,
          level: item.level,
          category: item.category,
          priority: item.priority,
          advice: item.advice,
          factsUsed: [...(item.facts_used || [])],
          behaviorTags: [...(item.behavior_tags || [])],
        })),
        feedback: {
          accepted: null,
          edited: null,
          caFeedback: null,
          eventOutcomeNotes: null,
        },
      };

      const latest = latestProjectFor(project);
      if (latest?.distanceResult?.stale === true) {
        markStale(latest);
        return;
      }
      const current = latest?.distanceAdviceResult;
      if (current && stablePayload(current) === stablePayload(trace) && current.stale !== true) return;
      writeAdviceResult(latest, trace);
    } catch (error) {
      console.warn('[Campsite Distance Advice Trace] sync failed', error);
    } finally {
      running = false;
    }
  }

  function schedule(delay = 120) {
    clearTimeout(timer);
    timer = setTimeout(() => { void syncTrace(); }, delay);
  }

  function boot() {
    const params = new URLSearchParams(location.search);
    if (params.get('campsiteProject') !== 'bridge') return;
    const observer = new MutationObserver(() => schedule());
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('campsite-project-updated', () => schedule(0));
    document.addEventListener('click', (event) => {
      if (event.target?.closest?.('[data-env-key]')) schedule(220);
    });
    schedule(500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
