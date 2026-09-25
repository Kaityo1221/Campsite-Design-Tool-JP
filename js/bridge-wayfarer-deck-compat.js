(() => {
  'use strict';

  const VERSION = '1.0.0';
  const SCOPE_MAPVIEW = 'mapview';
  const MODES = Object.freeze({
    PRESERVE_WAYFARER: 'PRESERVE_WAYFARER',
    DEFER_TO_WFMM: 'DEFER_TO_WFMM',
    NO_MAP: 'NO_MAP'
  });

  if (window.__campsiteBridgeWayfarerDeckCompatInstalled) return;
  window.__campsiteBridgeWayfarerDeckCompatInstalled = true;

  const snapshots = new Map();
  const diagnostics = {
    policyChecks: 0,
    suppressionRequests: 0,
    suppressionBlocked: 0,
    canvasesSuppressed: 0,
    restoreRequests: 0,
    canvasesRestored: 0,
    lastAction: 'not-run',
    lastReason: null
  };

  function displayOwnerApi() {
    return window.CampsiteBridgeWayfarerDisplayOwner || null;
  }

  function resolveOwner(root = document) {
    const api = displayOwnerApi();
    if (typeof api?.resolve !== 'function') return null;
    try {
      return api.resolve(root) || null;
    } catch (_) {
      return null;
    }
  }

  function pointerEventsOf(canvas) {
    try {
      if (typeof window.getComputedStyle === 'function') {
        return String(window.getComputedStyle(canvas)?.pointerEvents || '');
      }
    } catch (_) {}
    try { return String(canvas?.style?.pointerEvents || ''); } catch (_) { return ''; }
  }

  function getDeckCanvases(resolution) {
    const api = displayOwnerApi();
    if (typeof api?.findDeckCanvases !== 'function') return [];
    try {
      return api.findDeckCanvases(resolution?.map) || [];
    } catch (_) {
      return [];
    }
  }

  function policy(root = document) {
    diagnostics.policyChecks += 1;
    const resolution = resolveOwner(root);
    const owner = String(resolution?.owner || 'NONE');
    const sameMap = resolution?.wayfarerMap && resolution?.wfmmMap
      ? resolution.wayfarerMap === resolution.wfmmMap
      : null;
    const surface = resolution?.wayfarerContext?.surface || null;

    if (owner === 'WFMM') {
      return {
        mode: MODES.DEFER_TO_WFMM,
        owner,
        surface,
        sameMap,
        defaultMutation: false,
        explicitMutationEligible: surface === SCOPE_MAPVIEW && sameMap === true,
        resolution
      };
    }
    if (owner === 'WAYFARER') {
      return {
        mode: MODES.PRESERVE_WAYFARER,
        owner,
        surface,
        sameMap,
        defaultMutation: false,
        explicitMutationEligible: false,
        resolution
      };
    }
    return {
      mode: MODES.NO_MAP,
      owner: 'NONE',
      surface,
      sameMap,
      defaultMutation: false,
      explicitMutationEligible: false,
      resolution
    };
  }

  function blocked(reason, state) {
    diagnostics.suppressionBlocked += 1;
    diagnostics.lastAction = 'blocked';
    diagnostics.lastReason = reason;
    return {
      ok: false,
      mutated: false,
      reason,
      owner: state?.owner || 'NONE',
      suppressedCount: 0,
      alreadySuppressedCount: 0,
      passiveSkippedCount: 0,
      activeSuppressionCount: snapshots.size
    };
  }

  function requestSuppression(options = {}) {
    diagnostics.suppressionRequests += 1;
    const root = options.root || document;
    const state = policy(root);
    const reason = String(options.reason || '').trim();

    if (options.allowMutation !== true) return blocked('explicit-approval-required', state);
    if (String(options.scope || '') !== SCOPE_MAPVIEW) return blocked('scope-not-mapview', state);
    if (!reason) return blocked('explicit-reason-required', state);
    if (state.owner !== 'WFMM') return blocked(`owner-${String(state.owner || 'NONE').toLowerCase()}`, state);
    if (state.surface !== SCOPE_MAPVIEW) return blocked('surface-not-mapview', state);
    if (state.sameMap !== true) return blocked('map-mismatch', state);

    const canvases = getDeckCanvases(state.resolution);
    let suppressedCount = 0;
    let alreadySuppressedCount = 0;
    let passiveSkippedCount = 0;

    for (const canvas of canvases) {
      if (!canvas || String(canvas.id || '') !== 'deckgl-overlay') continue;
      if (canvas.isConnected === false) continue;
      const pointerEvents = pointerEventsOf(canvas);
      if (pointerEvents === 'none') {
        passiveSkippedCount += 1;
        continue;
      }
      if (snapshots.has(canvas)) {
        alreadySuppressedCount += 1;
        continue;
      }
      const style = canvas.style;
      if (!style || typeof style !== 'object') continue;
      snapshots.set(canvas, {
        visibility: style.visibility,
        pointerEvents: style.pointerEvents
      });
      style.visibility = 'hidden';
      style.pointerEvents = 'none';
      suppressedCount += 1;
    }

    diagnostics.canvasesSuppressed += suppressedCount;
    diagnostics.lastAction = suppressedCount > 0 ? 'suppressed' : 'no-change';
    diagnostics.lastReason = reason;
    return {
      ok: true,
      mutated: suppressedCount > 0,
      reason,
      owner: state.owner,
      suppressedCount,
      alreadySuppressedCount,
      passiveSkippedCount,
      activeSuppressionCount: snapshots.size
    };
  }

  function restoreSuppressed(reason = 'restore') {
    diagnostics.restoreRequests += 1;
    let restoredCount = 0;
    for (const [canvas, snapshot] of snapshots.entries()) {
      try {
        if (canvas?.style) {
          canvas.style.visibility = snapshot.visibility;
          canvas.style.pointerEvents = snapshot.pointerEvents;
          restoredCount += 1;
        }
      } catch (_) {}
      snapshots.delete(canvas);
    }
    diagnostics.canvasesRestored += restoredCount;
    diagnostics.lastAction = restoredCount > 0 ? 'restored' : 'restore-noop';
    diagnostics.lastReason = String(reason || 'restore');
    return {
      restoredCount,
      activeSuppressionCount: snapshots.size
    };
  }

  function reconcile(root = document) {
    const state = policy(root);
    if (snapshots.size > 0 && !state.explicitMutationEligible) {
      return {
        policy: state,
        restore: restoreSuppressed('owner-or-route-changed')
      };
    }
    return {
      policy: state,
      restore: null
    };
  }

  function getDiagnostics(root = document) {
    const state = policy(root);
    return {
      version: VERSION,
      defaultPolicy: 'preserve-native-deck',
      activeSuppressionCount: snapshots.size,
      policy: {
        mode: state.mode,
        owner: state.owner,
        surface: state.surface,
        sameMap: state.sameMap,
        defaultMutation: state.defaultMutation,
        explicitMutationEligible: state.explicitMutationEligible
      },
      ...diagnostics
    };
  }

  window.CampsiteBridgeWayfarerDeckCompat = Object.freeze({
    version: VERSION,
    modes: MODES,
    scopeMapview: SCOPE_MAPVIEW,
    policy,
    requestSuppression,
    restoreSuppressed,
    reconcile,
    getDiagnostics
  });
})();
