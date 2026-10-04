import assert from 'node:assert/strict';
import { createHarness, makeProject } from './wm3b2d-pseudo-harness.mjs';

function noSavedObservation(h) {
  assert.equal(h.sessionStorage.dump()?.wayfarerObservation, undefined, 'abnormal path must not save wayfarerObservation');
}

// 0 Wayfarer Map
{
  const h=createHarness({ mapCount:0 });
  const result=await h.connect();
  assert.equal(result.connected,false);
  assert.match(String(result.message),/Wayfarer Map/);
  noSavedObservation(h);
}

// 2 Wayfarer Maps
{
  const h=createHarness({ mapCount:2 });
  const result=await h.connect();
  assert.equal(result.connected,false);
  assert.match(String(result.message),/複数|1つだけ/);
  noSavedObservation(h);
}

// Polygon changes after request starts
{
  const h=createHarness();
  assert.equal((await h.connect()).connected,true);
  const pending=h.observe();
  const changed=h.sessionStorage.dump();
  changed.polygon=[[36,140],[36,140.01],[36.01,140.01],[36.01,140]];
  h.sessionStorage.setItem('campsiteProject.v1',JSON.stringify(changed));
  const result=await pending;
  assert.equal(result.status,'error');
  assert.match(String(result.message),/設計範囲が変更/);
  noSavedObservation(h);
}

// Corrupted RESULT
{
  const h=createHarness({ corruptResult:true });
  assert.equal((await h.connect()).connected,true);
  const result=await h.observe();
  assert.equal(result.status,'error');
  assert.match(String(result.message),/ゾーン情報|観察結果/);
  noSavedObservation(h);
}

// GCS failure
{
  const h=createHarness({ gcsFailure:true });
  assert.equal((await h.connect()).connected,true);
  const result=await h.observe();
  assert.equal(result.status,'error');
  assert.match(String(result.message),/GCS failure/);
  noSavedObservation(h);
}

// Observation result timeout after ACK
{
  const h=createHarness({ noResult:true });
  assert.equal((await h.connect()).connected,true);
  const result=await h.observe();
  assert.equal(result.status,'error');
  assert.match(String(result.message),/観察結果を受信できません/);
  noSavedObservation(h);
}

// Relay disconnect after successful connection
{
  const h=createHarness();
  assert.equal((await h.connect()).connected,true);
  h.bus.failRelayTo(h.wfTabIds[0]);
  const result=await h.observe();
  assert.equal(result.status,'error');
  assert.match(String(result.message),/中継|Wayfarer Map/);
  noSavedObservation(h);
}

// Observation engine busy
{
  const h=createHarness({ engineBusy:true });
  assert.equal((await h.connect()).connected,true);
  const result=await h.observe();
  assert.equal(result.status,'error');
  assert.match(String(result.message),/実行中/);
  noSavedObservation(h);
}

console.log('WM-3B-2D abnormal matrix: 0/2 tabs, stale polygon, corrupt result, GCS fail, timeout, relay disconnect, engine busy: OK');
