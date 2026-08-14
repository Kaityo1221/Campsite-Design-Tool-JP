import { test, expect } from '@playwright/test';

const STORAGE_KEY = 'campsiteWorkflowResumeV1';

async function login(page) {
  await page.goto('/index.html');
  await page.locator('#accessCodeInput').fill('CA2026');
  await page.locator('#loginButton').click();
  await expect(page.locator('#openingScreen')).toHaveClass(/show/, { timeout: 5000 });
}

test('作成方法と工程を保存し、再読込後に「前回のつづきから」で復帰できる', async ({ page }) => {
  await login(page);

  await page.evaluate(() => {
    window.selectCampsiteCsvMode('custom');
  });

  await expect(page.locator('#csvModeSummaryText')).toContainText('自作CSV');
  await expect(page.locator('[data-workflow-step="csv"]')).toHaveClass(/active/);

  const savedBeforeReload = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
  expect(savedBeforeReload).toContain('"mode":"custom"');
  expect(savedBeforeReload).toContain('"workflowStep":"csv"');

  await page.reload();
  await page.locator('#accessCodeInput').fill('CA2026');
  await page.locator('#loginButton').click();

  const resumeCard = page.locator('.workflow-resume-card');
  await expect(resumeCard).toBeVisible({ timeout: 5000 });
  await expect(resumeCard).toContainText('前回のつづき、覚えています。');
  await expect(resumeCard).toContainText('自作CSV');

  await resumeCard.locator('.workflow-resume-continue').click();

  await expect(page.locator('#tool')).toHaveClass(/active/, { timeout: 3000 });
  await expect(page.locator('#csvModeSummaryText')).toContainText('自作CSV');
  await expect(page.locator('[data-workflow-step="csv"]')).toHaveClass(/active/);
});

test('「新しく始める」で再開情報だけを削除して作成方法選択を開く', async ({ page }) => {
  await page.goto('/index.html');

  await page.evaluate(key => {
    localStorage.setItem(key, JSON.stringify({
      version: 1,
      mode: 'extracted',
      workflowStep: 'csv',
      lastTab: 'tool',
      updatedAt: Date.now()
    }));
  }, STORAGE_KEY);

  await page.reload();
  await page.locator('#accessCodeInput').fill('CA2026');
  await page.locator('#loginButton').click();

  const resumeCard = page.locator('.workflow-resume-card');
  await expect(resumeCard).toBeVisible({ timeout: 5000 });
  await resumeCard.locator('.workflow-resume-new').click();

  await expect(page.locator('#campsiteCsvModal')).toBeVisible();
  const saved = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
  expect(saved).toBeNull();
});
