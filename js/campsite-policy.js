/* ======================================================
   Campsite shared policy client

   Phase 1 goals:
   - One read path for the current Campsite policy.
   - Keep safe local defaults when the server is unavailable.
   - Expose a stable API for main / field / admin modes.
   - Policy writes stay server-side and require admin session auth.
====================================================== */
(function () {
  "use strict";

  if (window.CampsitePolicy) return;

  const FUNCTION_NAME = "campsite-policy";
  const DEFAULT_POLICY = Object.freeze({
    id: null,
    versionNo: 0,
    spacingMeters: 50,
    limits: Object.freeze({
      total: 25,
      pokestop: 12,
      gym: 8,
      powerSpot: 5
    }),
    note: "Local fallback policy",
    createdBy: "fallback",
    createdAt: null,
    source: "fallback"
  });

  let currentPolicy = {
    ...DEFAULT_POLICY,
    limits: { ...DEFAULT_POLICY.limits }
  };
  let loadingPromise = null;

  function toNullableLimit(value, fallback) {
    if (value === null) return null;
    const n = Number(value);
    return Number.isInteger(n) && n >= 0 ? n : fallback;
  }

  function normalizePolicy(row) {
    if (!row || typeof row !== "object") {
      return {
        ...DEFAULT_POLICY,
        limits: { ...DEFAULT_POLICY.limits }
      };
    }

    const spacing = Number(row.spacing_meters);
    const version = Number(row.version_no);

    return {
      id: row.id || null,
      versionNo: Number.isInteger(version) && version >= 0 ? version : 0,
      spacingMeters: Number.isFinite(spacing) && spacing > 0
        ? spacing
        : DEFAULT_POLICY.spacingMeters,
      limits: {
        total: toNullableLimit(row.total_poi_limit, DEFAULT_POLICY.limits.total),
        pokestop: toNullableLimit(row.pokestop_limit, DEFAULT_POLICY.limits.pokestop),
        gym: toNullableLimit(row.gym_limit, DEFAULT_POLICY.limits.gym),
        powerSpot: toNullableLimit(row.power_spot_limit, DEFAULT_POLICY.limits.powerSpot)
      },
      note: String(row.note || ""),
      createdBy: String(row.created_by || ""),
      createdAt: row.created_at || null,
      source: "server"
    };
  }

  function getSnapshot() {
    return {
      ...currentPolicy,
      limits: { ...currentPolicy.limits }
    };
  }

  function getLimit(name) {
    const key = name === "power" ? "powerSpot" : String(name || "");
    return Object.prototype.hasOwnProperty.call(currentPolicy.limits, key)
      ? currentPolicy.limits[key]
      : null;
  }

  function dispatchChange() {
    if (typeof window.dispatchEvent !== "function") return;
    window.dispatchEvent(new CustomEvent("campsitepolicychange", {
      detail: getSnapshot()
    }));
  }

  async function refresh() {
    if (loadingPromise) return loadingPromise;

    loadingPromise = (async () => {
      if (!window.campsiteSupabase?.functions) {
        return getSnapshot();
      }

      const { data, error } = await window.campsiteSupabase.functions.invoke(
        FUNCTION_NAME,
        { body: { action: "get" } }
      );

      if (error || !data?.success || !data?.policy) {
        throw error || new Error(data?.error || "Policy fetch failed");
      }

      currentPolicy = normalizePolicy(data.policy);
      dispatchChange();
      return getSnapshot();
    })();

    try {
      return await loadingPromise;
    } finally {
      loadingPromise = null;
    }
  }

  async function loadWhenReady() {
    for (let attempt = 0; attempt < 40; attempt++) {
      if (window.campsiteSupabase?.functions) {
        try {
          return await refresh();
        } catch (error) {
          console.warn("Campsite policy load failed; fallback remains active.", error);
          return getSnapshot();
        }
      }
      await new Promise(resolve => setTimeout(resolve, 250));
    }

    return getSnapshot();
  }

  const ready = loadWhenReady();

  window.CampsitePolicy = Object.freeze({
    defaults: DEFAULT_POLICY,
    ready,
    refresh,
    getSnapshot,
    getLimit,
    getSpacingMeters: () => currentPolicy.spacingMeters,
    isUsingFallback: () => currentPolicy.source !== "server"
  });
})();
