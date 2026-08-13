import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const exportSource = fs.readFileSync('js/field-mode-export.js', 'utf8');
const e2eSource = fs.readFileSync('tests/field-e2e.spec.mjs', 'utf8');

test('完成KMZの正式レイヤー契約を固定する', async () => {
  for (const token of [
    "pokestop:'追加希望ポケスト'",
    "gym:'追加希望ジム'",
    "power_spot:'追加希望パワスポ'",
    "ensureTargetFolder(doc,documentNode,'30m円（調整用）')",
    "ensureTargetFolder(doc,documentNode,'40m円（基本距離）')"
  ]) {
    expect(exportSource, `正式レイヤー契約が欠けています: ${token}`).toContain(token);
  }

  const appendPois = exportSource.indexOf('appendNewPois(doc,documentNode,newRecords,photoPaths)');
  const appendCircles = exportSource.indexOf('appendGeneratedCirclesToExistingLayers(doc,documentNode,newRecords)');
  expect(appendPois).toBeGreaterThan(-1);
  expect(appendCircles).toBeGreaterThan(appendPois);
});

test('完成E2Eが提出用KMZの主要品質条件を検査し続ける', async () => {
  for (const token of [
    "folderPointNames(kml, '既存のポケストップ')",
    "folderPointNames(kml, '既存のジム')",
    "folderPointNames(kml, '既存のパワースポット')",
    "folderPointNames(kml, '追加希望ポケスト')",
    "folderPlacemarkNames(kml, '40m円（基本距離）')",
    "folderPlacemarkNames(kml, '30m円（調整用）')",
    "expect(kml).toContain('<name>活動範囲 1</name>')",
    "expect(kml).not.toContain('<name>調査範囲</name>')",
    "expect(kml).not.toContain('<name>追加希望POI</name>')"
  ]) {
    expect(e2eSource, `完成E2Eの品質検査が欠けています: ${token}`).toContain(token);
  }
});
