import { copy, fail, validatePoi } from './poi-model.mjs';
import { normalizePois, defaultIdFactory } from './poi-id.mjs';
import { assessLimits } from './poi-limits.mjs';
import { planCommand, protectTransition } from './poi-commands.mjs';
import { createHistory } from './history.mjs';

export function createPoiStore(initial = [], { idFactory = defaultIdFactory } = {}) {
  let records = [], version = 0, lastImport = null;
  const issued = new Set(), history = createHistory();
  const errorResult = error => ({ ok: false, changed: false, error: { code: error.code ?? 'INVALID_DATA', message: error.message } });
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  function replace(inputs) {
    const result = normalizePois(inputs, { idFactory });
    if (!result.ok) return copy(result);
    const counts = assessLimits(result.records);
    if (!counts.existingAllowed) return {
      ok: false, changed: false, records: [], mapping: [], warnings: copy(result.warnings),
      errors: [{ code: 'EXISTING_LIMIT', message: '既存701件以上のため全件の反映を拒否しました' }], counts,
    };
    // A matching internal ID denotes the same POI, even across a full replacement.
    // Validate every overlap before mutating records, history, version or import report.
    // Unrelated imports with colliding IDs need upstream disambiguation, not silent overwrite.
    const priorById = new Map(records.map(p => [p.id, p]));
    const conflicts = [];
    for (const [index, incoming] of result.records.entries()) {
      const prior = priorById.get(incoming.id);
      if (!prior) continue;
      try { protectTransition(prior, incoming); }
      catch (error) {
        conflicts.push({ index, id: incoming.id, code: error.code ?? 'INVALID_DATA', message: error.message });
      }
    }
    if (conflicts.length) return {
      ok: false, changed: false, records: [], mapping: [], warnings: copy(result.warnings),
      errors: conflicts, counts: copy(counts),
    };
    records = copy(result.records);
    records.forEach(p => issued.add(p.id));
    lastImport = { mapping: copy(result.mapping), warnings: copy(result.warnings) };
    history.clear();
    version += 1;
    return { ok: true, changed: true, ...copy(lastImport), counts: copy(counts) };
  }

  function applyEntry(entry, direction) {
    const expected = direction === 'undo' ? entry.after : entry.before;
    const target = direction === 'undo' ? entry.before : entry.after;
    const index = records.findIndex(p => p.id === entry.id);
    const current = index >= 0 ? records[index] : null;
    if (!same(current, expected)) fail('HISTORY_CONFLICT', '現在の状態と履歴が一致しません');
    protectTransition(current, target);
    if (target) validatePoi(target);
    // Replay restores an accepted state, including imported new over-limit data.
    if (!target) records.splice(index, 1);
    else if (index < 0) records.push(copy(target));
    else records[index] = copy(target);
    version += 1;
  }

  const initialResult = replace(initial);
  if (!initialResult.ok) fail('INITIAL_DATA_REJECTED', '初期データを受け付けません', initialResult);

  return Object.freeze({
    snapshot() { return { records: copy(records), counts: assessLimits(records), history: history.counts(), version }; },
    importReport() { return copy(lastImport); },
    replace,
    resetHistory() { history.clear(); return { ok: true }; },
    execute(command, { confirmed = false } = {}) {
      if (confirmed !== true) return { ok: true, cancelled: true, changed: false };
      try {
        const entry = planCommand(records, command, { reserved: issued, idFactory });
        if (same(entry.before, entry.after)) return { ok: true, changed: false, id: entry.id };
        applyEntry(entry, 'redo');
        issued.add(entry.id);
        history.record(entry);
        return { ok: true, changed: true, id: entry.id };
      } catch (error) { return errorResult(error); }
    },
    undo() {
      const entry = history.peekUndo();
      if (!entry) return { ok: true, changed: false };
      try { applyEntry(entry, 'undo'); history.acceptUndo(); return { ok: true, changed: true }; }
      catch (error) { return errorResult(error); }
    },
    redo() {
      const entry = history.peekRedo();
      if (!entry) return { ok: true, changed: false };
      try { applyEntry(entry, 'redo'); history.acceptRedo(); return { ok: true, changed: true }; }
      catch (error) { return errorResult(error); }
    },
  });
}
