import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const leafletJs = fs.readFileSync('node_modules/leaflet/dist/leaflet.js', 'utf8');
const leafletCss = fs.readFileSync('node_modules/leaflet/dist/leaflet.css', 'utf8');

test.beforeEach(async ({ page }) => {
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: leafletJs
  }));
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', route => route.fulfill({
    status: 200,
    contentType: 'text/css',
    body: leafletCss
  }));
});

test('Phase 5-D6 Candidate Renderer parity passes on iPhone/WebKit', async ({ page }) => {
  const browserErrors = [];
  page.on('console', message => {
    if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', error => browserErrors.push(`pageerror: ${error.message}`));

  await page.goto('/bridge-map-lab/candidate-shadow-parity-test.html');
  await expect(page.locator('#run')).toBeVisible();
  await page.locator('#run').click();

  await expect(page.locator('#summary')).toContainText('PASS');
  const result = await page.evaluate(() => window.__candidateShadowParity);
  expect(result).toBeTruthy();
  expect(result.passed).toBe(result.total);
  expect(result.total).toBeGreaterThanOrEqual(24);
  expect(browserErrors).toEqual([]);
});
