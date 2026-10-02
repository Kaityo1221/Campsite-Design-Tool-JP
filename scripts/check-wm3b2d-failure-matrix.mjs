import assert from 'node:assert/strict';
import { createHarness, makeProject } from './wm3b2d-pseudo-harness.mjs';

function assertNoObservation(h, label) {
  const saved = h.sessionStorage.dump();
  assert.equal(saved?.wayfarerObservation, undefined, label + ': must not save wayfarerObservation');
}

{
  const h = createHarness({ mapCount:0 });
  const result = await h.connect();
  assert.equal(result.connected, false);
  assert.match(result.message, /Wayfarer Map/);
  assertNoObservation(h, '0 map tabs');
}

{
  const h = createHarness({ mapCount:2 });
  const result = await h.connect();
  assert.equal(result.connected, false);
  assert.match(result.message, /複数|1つだけ/);
  assertNoObservation(h, '2 map tabs');
}

{
  const h = createHarness({ gcsFailure:true });
  const connected = await h.connect();
  assert.equal(connected.connected, true);
  const result = await h.observe();
  assert.equal(result.status, 'error');
  assert.match(result.message, /GCS|simulated/i);
  assertNoObservation(h, 'GCS failure');
}

{
  const h = createHarness({ engineBusy:true });
  const connected = await h.connect();
  assert.equal(connected.connected, true);
  const result = await h.observe();
  assert.equal(result.status, 'error');
  assert.match(result.message, /実行中|観察処理/);
  assertNoObservation(h, 'engine busy');
}

{
  const h = createHarness({ corruptResult:true });
  const connected = await h.connect();
  assert.equal(connected.connected, true);
  const result = await h.observe();
  assert.equal(result.status, 'error');
  assert.match(result.message, /ゾーン|形式|確認/);
  assertNoObservation(h, 'corrupt result');
}

{
  const h = createHarness({ noResult:true });
  const connected = await h.connect();
  assert.equal(connected.connected, true);
  const result = await h.observe();
  assert.equal(result.status, 'error');
  assert.match(result.message, /観察結果を受信できません/);
  assertNoObservation(h, 'observation timeout');
}

{
  const h = createHarness();
  const connected = await h.connect();
  assert.equal(connected.connected, true);
  h.bus.failRelayTo(h.wfTabIds[0]);
  const result = await h.observe();
  assert.equal(result.status, 'error');
  assert.match(result.message, /中継|再読み込み/);
  assertNoObservation(h, 'relay disconnect');
}

{
  const project = makeProject();
  const h = createHarness({ project, gcsDelay:60 });
  const connected = await h.connect();
  assert.equal(connected.connected, true);
  const promise = h.observe();
  await new Promise(resolve => setTimeout(resolve, 15));
  const changed = h.sessionStorage.dump();
  changed.polygon = [[36,140],[36,140.01],[36.01,140.01],[36.01,140]];
  h.sessionStorage.setItem('campsiteProject.v1', JSON.stringify(changed));
  const result = await promise;
  assert.equal(result.status, 'error');
  assert.match(result.message, /観察中に設計範囲が変更/);
  assertNoObservation(h, 'polygon changed during observation');
}

console.log('WM-3B-2D abnormal matrix: 0 tabs / 2 tabs / stale polygon / corrupt result / GCS failure / timeout / relay disconnect / engine busy: OK');
