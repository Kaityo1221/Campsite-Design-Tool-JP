/*
 * An isolated, explicit boundary between Phase 1-A canonical POI store snapshots
 * and Phase 1-B FRESH (not legacy/source-bearing) KMZ and journal payloads.
 * No DOM, storage, network, or live app mutation. No import auto-commit.
 */
import { validatePoi } from '../../phase-1a/core/poi-model.mjs';
import { createFreshV1Kmz } from '../core/create-new-kmz.mjs';

const ALLOWED_KEYS = new Set(['id','role','kind','title','memo','lat','lng','deleted','guid','poiId','metadata']);
function stop(reason) { const e = new Error(reason); e.code = 'PHASE1A_BRIDGE_HOLD'; throw e; }
function isPlainObject(value) { return !!value && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null); }
function ensureArea(area, ids) {
  if (!isPlainObject(area) || Object.keys(area).some(k => !['id','points'].includes(k)) ||
      typeof area.id !== 'string' || !area.id || ids.has(area.id) || !Array.isArray(area.points) ||
      area.points.length < 3 || area.points.some(p => !Array.isArray(p) || p.length !== 2 ||
      p.some((v,j) => typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > (j===0 ? 90 : 180)))) stop('Unrecognized or invalid activity area');
  ids.add(area.id);
  return {id:area.id,points:area.points.map(p=>[p[0],p[1]])};
}

export function preparePhase1AFreshBoundary(storeSnapshot,{activityAreas=[]}={}) {
  if (!isPlainObject(storeSnapshot) || !Array.isArray(storeSnapshot.records) || !Array.isArray(activityAreas)) stop('Invalid Phase 1-A snapshot');
  const ids = new Set();
  const canonical=[];
  const exportRecords=[];
  for (const r of storeSnapshot.records) {
    if (!isPlainObject(r) || Object.keys(r).some(key=>!ALLOWED_KEYS.has(key)) ||
        !isPlainObject(r.metadata) || Object.keys(r.metadata).length !== 0) stop('Source or unknown POI attributes cannot use fresh KMZ export');
    try { validatePoi(r); } catch { stop('Invalid Phase 1-A POI record'); }
    if (ids.has(r.id)) stop('Duplicate internal ID');
    ids.add(r.id);
    const record = {
      id:r.id, role:r.role, kind:r.kind, title:r.title, memo:r.memo,
      lat:r.lat, lng:r.lng, deleted:r.deleted,
      ...(r.guid !== null ? {guid:r.guid} : {}),
      ...(r.poiId !== null ? {poiId:r.poiId} : {}),
    };
    exportRecords.push(record);
    // Keep a fresh POI snapshot also valid for Phase 1-A, not a lossy export view.
    canonical.push({...record,guid:r.guid,poiId:r.poiId,metadata:{}});
  }
  const areaIds = new Set();
  const mappedAreas=activityAreas.map(a=>ensureArea(a,areaIds));
  const liveExisting=exportRecords.filter(r=>!r.deleted && r.role==='existing').length;
  if(liveExisting > 700)stop('Existing 701+ POIs');
  const forExport={records:exportRecords,activityAreas:mappedAreas};
  const forJournal={records:canonical,activityAreas:structuredClone(mappedAreas)};
  return {forExport,forJournal};
}

export async function exportPhase1AFreshKmz(storeSnapshot,{activityAreas=[], ...dependencies}={}) {
  const boundary=preparePhase1AFreshBoundary(storeSnapshot,{activityAreas});
  return createFreshV1Kmz(boundary.forExport,dependencies);
}
