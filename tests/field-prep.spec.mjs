import { test, expect } from '@playwright/test';

const csvA = [
  'name,latitude,longitude,gameEntity,guid',
  '公園入口,35.680000,139.760000,Pokestop,guid-a',
  '中央広場,35.681000,139.761000,Gym,guid-b',
  ''
].join('\n');

const csvB = [
  'name,latitude,longitude,gameEntity,guid',
  '公園入口（重複）,35.680000,139.760000,Pokestop,guid-a',
  '北側広場,35.682000,139.762000,Power Spot,guid-c',
  ''
].join('\n');

test('複数の調査ファイルをまとめて読み込み、重複整理と種類別集計ができる', async ({ page }) => {
  await page.goto('/field-prep.html');

  await expect(page.getByRole('button', { name: '地図に読み込む' })).toBeVisible();
  await expect(page.getByText('調査ファイルを選ぶ', { exact: true }).first()).toBeVisible();
  await expect(page.locator('#fieldPrepClearButton')).toBeHidden();

  await page.locator('#fieldPrepFiles').setInputFiles([
    { name: 'area-a.csv', mimeType: 'text/csv', buffer: Buffer.from(csvA) },
    { name: 'area-b.csv', mimeType: 'text/csv', buffer: Buffer.from(csvB) }
  ]);

  await expect(page.locator('.field-prep-file-remove')).toHaveCount(2);
  await expect(page.locator('#fieldPrepAnalyzeButton')).toBeEnabled();
  await page.locator('#fieldPrepAnalyzeButton').click();

  await expect(page.locator('#fieldPrepResults')).toBeVisible();
  await expect(page.locator('#fieldPrepCsvCount')).toHaveText('2');
  await expect(page.locator('#fieldPrepRawCount')).toHaveText('4');
  await expect(page.locator('#fieldPrepDuplicateCount')).toHaveText('1');
  await expect(page.locator('#fieldPrepUniqueCount')).toHaveText('3');
  await expect(page.locator('#fieldPrepPokestopCount')).toHaveText('1');
  await expect(page.locator('#fieldPrepGymCount')).toHaveText('1');
  await expect(page.locator('#fieldPrepPowerCount')).toHaveText('1');
  await expect(page.locator('#fieldPrepStatus')).toContainText('準備完了：3件');
});

test('ファイル名の右にある解除で1件だけ外せる', async ({ page }) => {
  await page.goto('/field-prep.html');

  await page.locator('#fieldPrepFiles').setInputFiles([
    { name: 'area-a.csv', mimeType: 'text/csv', buffer: Buffer.from(csvA) },
    { name: 'area-b.csv', mimeType: 'text/csv', buffer: Buffer.from(csvB) }
  ]);

  await expect(page.locator('.field-prep-file-item')).toHaveCount(2);
  await page.locator('.field-prep-file-item').filter({ hasText: 'area-a.csv' }).getByRole('button', { name: 'area-a.csvを解除' }).click();

  await expect(page.locator('.field-prep-file-item')).toHaveCount(1);
  await expect(page.locator('.field-prep-file-item')).toContainText('area-b.csv');
  await page.locator('#fieldPrepAnalyzeButton').click();

  await expect(page.locator('#fieldPrepCsvCount')).toHaveText('1');
  await expect(page.locator('#fieldPrepRawCount')).toHaveText('2');
  await expect(page.locator('#fieldPrepDuplicateCount')).toHaveText('0');
  await expect(page.locator('#fieldPrepUniqueCount')).toHaveText('2');
});

test('最後のファイルを解除すると準備結果も消える', async ({ page }) => {
  await page.goto('/field-prep.html');

  await page.locator('#fieldPrepFiles').setInputFiles({
    name: 'area-a.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csvA)
  });
  await page.locator('#fieldPrepAnalyzeButton').click();
  await expect(page.locator('#fieldPrepResults')).toBeVisible();

  await page.getByRole('button', { name: 'area-a.csvを解除' }).click();

  await expect(page.locator('#fieldPrepResults')).toBeHidden();
  await expect(page.locator('#fieldPrepAnalyzeButton')).toBeDisabled();
  await expect(page.locator('#fieldPrepStatus')).toHaveText('調査ファイルを選んでください。');
});

test('iPhone幅で長いファイル名は横スクロールして末尾を確認できる', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/field-prep.html');

  const longName = 'nearby-wayspots-2026-08-09-葛西臨海公園-調査エリア-西側-追加取得データ-最終確認用-8.csv';
  await page.locator('#fieldPrepFiles').setInputFiles({
    name: longName,
    mimeType: 'text/csv',
    buffer: Buffer.from(csvA)
  });

  const fileName = page.locator('.field-prep-file-name').first();
  await expect(fileName).toContainText(longName);

  const sizes = await fileName.evaluate(element => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth
  }));
  expect(sizes.scrollWidth).toBeGreaterThan(sizes.clientWidth);

  const scrollLeft = await fileName.evaluate(element => {
    element.scrollLeft = element.scrollWidth;
    return element.scrollLeft;
  });
  expect(scrollLeft).toBeGreaterThan(0);
});
