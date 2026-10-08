import { createPoiStore } from './core/poi-store.mjs';
import { additionReason, kindChangeReason } from './core/poi-limits.mjs';
import { convertLegacy } from './adapters/legacy-records.mjs';
import { poi, existing, candidates, legacyCollision } from './tests/fixtures/poi-cases.mjs';

const $ = id => document.getElementById(id);
const labels = { pokestop: 'ポケストップ', gym: 'ジム', power: 'パワースポット' };
const store = createPoiStore([poi('existing', { role: 'existing', title: '既存試験地点' }), poi('new')]);
let selectedId = null;
let conversionReport = null;

function message(result, success = '反映しました') {
  $('message').textContent = result.ok ? success : result.error?.message ?? result.errors?.map(e => e.message).join(' / ') ?? '反映できません';
}
function closeEdit() { selectedId = null; $('edit-form').hidden = true; }
function discardDrafts() {
  if ((selectedId || !$('add-form').hidden) && !confirm('未確定の入力を破棄しますか？')) return false;
  closeEdit(); $('add-form').hidden = true; $('open-add').setAttribute('aria-expanded', 'false');
  return true;
}
function renderCapacity() {
  const snapshot = store.snapshot();
  for (const option of $('add-kind').options) option.disabled = !snapshot.counts.new.types[option.value].canAdd;
  const reason = additionReason(snapshot.records, $('add-kind').value);
  $('add-confirm').disabled = !!reason;
  $('add-reason').textContent = reason ?? '合計と対象種類に空きがあります';
}
function render() {
  const snapshot = store.snapshot(), c = snapshot.counts;
  $('counts').textContent = `既存 ${c.existing.count} / 700（${c.existing.level}）\n新規 ${c.new.count} / 25・残り${c.new.remaining}・超過${c.new.excess}\n` +
    Object.entries(c.new.types).map(([kind, v]) => `${labels[kind]} ${v.count} / ${v.limit}・残り${v.remaining}・超過${v.excess}`).join('\n') +
    (c.newOverLimit ? '\n新規上限超過：データを保持。追加だけを制限します。' : '');
  $('undo').disabled = !snapshot.history.undo; $('redo').disabled = !snapshot.history.redo;
  $('history-count').textContent = `Undo ${snapshot.history.undo} / Redo ${snapshot.history.redo}`;
  $('diagnostics').textContent = JSON.stringify({ conversion: conversionReport, acceptedData: store.importReport() }, null, 2);
  $('pois').replaceChildren();
  for (const p of snapshot.records.slice(0, 50)) {
    const tr = document.createElement('tr'); tr.dataset.poiId = p.id;
    for (const text of [p.title, `${p.role === 'existing' ? '既存' : '新規'} / ${labels[p.kind]}`, `${p.id}\nGUID: ${p.guid ?? 'なし'}\npoiId: ${p.poiId ?? 'なし'}`, p.deleted ? '削除済み' : '有効']) {
      const td = document.createElement('td'); td.textContent = text; tr.appendChild(td);
    }
    const td = document.createElement('td'), button = document.createElement('button');
    button.type = 'button'; button.textContent = '編集'; button.disabled = p.deleted;
    button.addEventListener('click', () => openEdit(p.id)); td.appendChild(button); tr.appendChild(td); $('pois').appendChild(tr);
  }
  renderCapacity();
}
function openEdit(id) {
  if (!discardDrafts()) return;
  const p = store.snapshot().records.find(r => r.id === id);
  if (!p || p.deleted) return;
  selectedId = id; $('edit-form').hidden = false;
  $('selected').textContent = `${p.title} / ${p.id} / ${p.role === 'existing' ? '既存座標は保護されています' : '新規'}`;
  for (const key of ['title', 'memo', 'kind', 'lat', 'lng']) $('edit-' + key).value = p[key];
  $('edit-lat').disabled = $('edit-lng').disabled = p.role === 'existing';
  for (const option of $('edit-kind').options) option.disabled = !!kindChangeReason(store.snapshot().records, p, option.value);
}
$('load').addEventListener('click', () => {
  if (!discardDrafts()) return;
  const choice = $('fixture').value;
  let records;
  if (choice === 'legacy') {
    const result = convertLegacy(legacyCollision);
    if (!result.ok) { message(result); return; }
    records = result.records;
    conversionReport = { mapping: result.mapping, warnings: result.warnings };
    message({ ok: true }, '3件を保持し、旧IDを対応付けました。詳細は診断欄で確認できます。');
  } else {
    records = choice === 'over' ? candidates(13, 8, 5) : choice === '700' || choice === '701' ? existing(Number(choice)) : [poi('existing', { role: 'existing' }), poi('new')];
  }
  const result = store.replace(records);
  if (result.ok && choice !== 'legacy') conversionReport = null;
  if (choice !== 'legacy' || !result.ok) message(result, '試験データを反映しました。履歴は空です。');
  render();
});
$('open-add').addEventListener('click', () => {
  if (!$('add-form').hidden) return;
  if (!discardDrafts()) return;
  $('add-form').hidden = false; $('open-add').setAttribute('aria-expanded', 'true'); renderCapacity();
});
$('add-kind').addEventListener('change', renderCapacity);
$('add-form').addEventListener('submit', event => {
  event.preventDefault();
  const result = store.execute({ type: 'add', poi: { role: 'new', kind: $('add-kind').value, title: $('add-title').value, memo: '', lat: $('add-lat').valueAsNumber, lng: $('add-lng').valueAsNumber } }, { confirmed: true });
  message(result); render();
});
$('add-cancel').addEventListener('click', () => {
  store.execute({ type: 'add' }, { confirmed: false });
  $('add-form').hidden = true; $('open-add').setAttribute('aria-expanded', 'false'); message({ ok: true }, '追加を取り消しました。データと履歴は不変です。');
});
$('edit-form').addEventListener('submit', event => {
  event.preventDefault();
  const patch = { title: $('edit-title').value, memo: $('edit-memo').value, kind: $('edit-kind').value };
  if (!$('edit-lat').disabled) { patch.lat = $('edit-lat').valueAsNumber; patch.lng = $('edit-lng').valueAsNumber; }
  const result = store.execute({ type: 'edit', id: selectedId, patch }, { confirmed: true });
  message(result); if (result.ok) closeEdit(); render();
});
$('edit-cancel').addEventListener('click', () => { closeEdit(); message({ ok: true }, '編集を取り消しました'); });
$('delete').addEventListener('click', () => {
  const p = store.snapshot().records.find(r => r.id === selectedId);
  if (!p || !confirm(`「${p.title}」を削除しますか？`)) return;
  const result = store.execute({ type: 'delete', id: p.id }, { confirmed: true });
  message(result); if (result.ok) closeEdit(); render();
});
for (const action of ['undo', 'redo']) $(action).addEventListener('click', () => {
  if (!discardDrafts()) return;
  message(store[action]()); render();
});
$('reset-history').addEventListener('click', () => {
  if (!discardDrafts() || !confirm('履歴だけを空にしますか？POIは保持します。')) return;
  store.resetHistory(); message({ ok: true }, '履歴を初期化しました'); render();
});
render();