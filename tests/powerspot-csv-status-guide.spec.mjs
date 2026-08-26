import { test, expect } from '@playwright/test';

const activeOnlyCsv = [
  'guid,title,lat,lng,gameEntity,gameStatus',
  'ps-active,Active Power Spot,35.640000,139.850000,POWERSPOT,ACTIVE',
  'stop-1,Pokestop,35.641000,139.851000,POKESTOP,ACTIVE',
  ''
].join('\n');

const activeAndInactiveCsv = [
  'guid,title,lat,lng,gameEntity,gameStatus',
  'ps-active,Active Power Spot,35.640000,139.850000,POWERSPOT,ACTIVE',
  'ps-inactive,Inactive Power Spot,35.642000,139.852000,POWERSPOT,INACTIVE',
  ''
].join('\n');

test('Wayfarer Map Modsでinactive Power Spotを含めて抽出する案内を表示する', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('.campsite-file-guide-card.new')).toContainText(
    'Display inactive Power Spots the same as active'
  );
});

test('Power SpotがACTIVEだけのCSVでは抽出設定の確認を促す', async ({ page }) => {
  await page.goto('/');

  await page.locator('#fileInput').setInputFiles({
    name: 'nearby-wayspots-active-only.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(activeOnlyCsv)
  });

  const notice = page.locator('.campsite-powerspot-status-notice');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('INACTIVE Power Spotが0件');
  await expect(notice).toContainText('Display inactive Power Spots the same as active');
});

test('INACTIVE Power Spotを既存PowerSpotとして扱えることを確認する', async ({ page }) => {
  await page.goto('/');

  const parsed = await page.evaluate(csv => {
    const points = parseCSV(csv);
    const inactive = points.find(point => point.guid === 'ps-inactive');

    return {
      gameStatus: inactive?.gameStatus,
      classifiedType: classifyType(inactive?.type, inactive?.name, inactive?.layer)
    };
  }, activeAndInactiveCsv);

  expect(parsed.gameStatus).toBe('INACTIVE');
  expect(parsed.classifiedType).toBe('power');

  await page.locator('#fileInput').setInputFiles({
    name: 'nearby-wayspots-with-inactive.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(activeAndInactiveCsv)
  });

  const notice = page.locator('.campsite-powerspot-status-notice');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('ACTIVE 1件 / INACTIVE 1件');
  await expect(notice).toContainText('INACTIVEも既存PowerSpotとして取り込みます');
});
