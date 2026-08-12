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

test('複数CSVをまとめて読み込み、重複整理と種類別集計ができる', async ({ page }) => {
  await page.goto('/field-prep.html');

  await page.locator('#fieldPrepFiles').setInputFiles([
    { name: 'area-a.csv', mimeType: 'text/csv', buffer: Buffer.from(csvA) },
    { name: 'area-b.csv', mimeType: 'text/csv', buffer: Buffer.from(csvB) }
  ]);

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

test('選択をクリアすると準備結果も消える', async ({ page }) => {
  await page.goto('/field-prep.html');

  await page.locator('#fieldPrepFiles').setInputFiles({
    name: 'area-a.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csvA)
  });
  await page.locator('#fieldPrepAnalyzeButton').click();
  await expect(page.locator('#fieldPrepResults')).toBeVisible();

  await page.locator('#fieldPrepClearButton').click();

  await expect(page.locator('#fieldPrepResults')).toBeHidden();
  await expect(page.locator('#fieldPrepAnalyzeButton')).toBeDisabled();
  await expect(page.locator('#fieldPrepStatus')).toHaveText('CSVを選択してください。');
});
