import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const exportSource = fs.readFileSync('js/field-mode-export.js', 'utf8');

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
