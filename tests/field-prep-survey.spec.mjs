import { test, expect } from '@playwright/test';

test('調査範囲の内外判定ができ、境界上も範囲内として扱う', async ({ page }) => {
  await page.goto('/field-prep.html');

  const result = await page.evaluate(() => {
    const polygon = [
      [35.6800, 139.7600],
      [35.6800, 139.7640],
      [35.6840, 139.7640],
      [35.6840, 139.7600]
    ];

    return {
      inside: window.FieldPrepSurvey.pointInPolygon({ lat: 35.6820, lng: 139.7620 }, polygon),
      outside: window.FieldPrepSurvey.pointInPolygon({ lat: 35.6860, lng: 139.7620 }, polygon),
      boundary: window.FieldPrepSurvey.pointInPolygon({ lat: 35.6800, lng: 139.7620 }, polygon)
    };
  });

  expect(result.inside).toBe(true);
  expect(result.outside).toBe(false);
  expect(result.boundary).toBe(true);
});

test('現地モード用KMLは正式フォルダと40m円を含み、調査範囲は出力しない', async ({ page }) => {
  await page.goto('/field-prep.html');

  const kml = await page.evaluate(() => window.FieldPrepSurvey.buildFieldKml([
    { name: '入口', lat: 35.6800, lng: 139.7600, type: 'Pokestop', gameStatus: '' },
    { name: '広場', lat: 35.6810, lng: 139.7610, type: 'Gym', gameStatus: '' },
    { name: '北側', lat: 35.6820, lng: 139.7620, type: 'Power Spot', gameStatus: '' }
  ]));

  for (const folderName of [
    '既存のポケストップ',
    '既存のジム',
    '既存のパワースポット',
    '追加希望ポケスト',
    '追加希望ジム',
    '追加希望パワスポ',
    '活動範囲',
    '40m円（基本距離）',
    '30m円（調整用）'
  ]) {
    expect(kml).toContain(`<name>${folderName}</name>`);
  }

  expect(kml).toContain('入口_40m円');
  expect(kml).toContain('広場_40m円');
  expect(kml).toContain('北側_40m円');
  expect(kml).not.toContain('<name>調査範囲</name>');
});

test('準備専用IndexedDBへ保存して復元できる', async ({ page }) => {
  await page.goto('/field-prep.html');

  const saved = await page.evaluate(async () => {
    await window.FieldPrepSession.clear();
    await window.FieldPrepSession.save({
      core: {
        rawPoints: [{ name: '保存POI', lat: 35.68, lng: 139.76 }],
        uniquePoints: [{ name: '保存POI', lat: 35.68, lng: 139.76 }],
        duplicateCount: 0,
        fileResults: [{ name: 'saved.csv', count: 1, error: '' }]
      },
      survey: { polygon: [[35.67, 139.75], [35.67, 139.77], [35.69, 139.76]] }
    });
    return window.FieldPrepSession.load();
  });

  expect(saved.version).toBe(1);
  expect(saved.core.uniquePoints).toHaveLength(1);
  expect(saved.core.uniquePoints[0].name).toBe('保存POI');
  expect(saved.survey.polygon).toHaveLength(3);
});
