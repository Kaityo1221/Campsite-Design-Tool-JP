(() => {
  'use strict';

  const STATE_KEY = 'wayfarerObservationDiffState';

  function cleanCounts(value) {
    const source = value && typeof value === 'object' ? value : {};
    const result = {};
    for (const [guid, count] of Object.entries(source)) {
      const id = String(guid || '').trim();
      const n = Number(count);
      if (id && Number.isFinite(n) && n > 0) result[id] = Math.floor(n);
    }
    return result;
  }

  function readState(project) {
    const raw = project?.[STATE_KEY];
    return Object.freeze({
      baseSnapshotId:String(raw?.baseSnapshotId || ''),
      lastRemoteSnapshotId:String(raw?.lastRemoteSnapshotId || ''),
      absenceCounts:Object.freeze(cleanCounts(raw?.absenceCounts))
    });
  }

  function persistState(project, diffResult) {
    if (!project || typeof project !== 'object') {
      return Object.freeze({canPersist:false, reason:'PROJECT_INVALID', project});
    }
    if (diffResult?.canApply !== true || diffResult?.remoteComplete !== true) {
      return Object.freeze({canPersist:false, reason:'DIFF_NOT_PERSISTABLE', project});
    }
    const baseSnapshotId = String(diffResult.baseSnapshotId || '');
    const remoteSnapshotId = String(diffResult.remoteSnapshotId || '');
    if (!baseSnapshotId || !remoteSnapshotId) {
      return Object.freeze({canPersist:false, reason:'SNAPSHOT_ID_MISSING', project});
    }

    const state = Object.freeze({
      baseSnapshotId,
      lastRemoteSnapshotId:remoteSnapshotId,
      absenceCounts:Object.freeze(cleanCounts(diffResult.nextAbsenceCounts))
    });
    const nextProject = {...project, [STATE_KEY]:state};
    return Object.freeze({canPersist:true, reason:'STATE_READY', project:nextProject, state});
  }

  window.bridgeMapLab_readWayfarerObservationDiffState = readState;
  window.bridgeMapLab_persistWayfarerObservationDiffState = persistState;
  window.bridgeMapLab_wayfarerObservationDiffStateKey = STATE_KEY;
})();