import { copy } from './poi-model.mjs';

// Per-POI deltas keep full 700-record snapshots out of the history stacks.
export function createHistory() {
  const undo = [], redo = [];
  return Object.freeze({
    record(entry) { undo.push(copy(entry)); redo.length = 0; },
    peekUndo() { return undo.length ? copy(undo.at(-1)) : null; },
    peekRedo() { return redo.length ? copy(redo.at(-1)) : null; },
    acceptUndo() { redo.push(undo.pop()); },
    acceptRedo() { undo.push(redo.pop()); },
    clear() { undo.length = 0; redo.length = 0; },
    counts() { return { undo: undo.length, redo: redo.length }; },
  });
}
