import { test, expect } from '@playwright/test';

const STORAGE_KEY = 'campsiteWorkflowResumeV1';

async function login(page, path = '/index.html') {
  await page.goto(path);

  const loginInput = page.locator('#accessCodeInput');
  if (await loginInput.count()) {
    await loginInput.fill('CA2026');
    await page.locator('#loginButton').click();
  }

  await expect(page.locator('#openingScreen')).toHaveClass(/show/, { timeout: 5000 });
}

test('作成方法と工程を保存し、アプリを開き直した後に「前回のつづきから」で復帰できる', async ({ page, context }) => {
  await login(page);

  await page.evaluate(() => {
    window.selectCampsiteCsvMode('custom');
  });

  await expect(page.locator('#csvModeSummaryText')).toContainText('自作CSV');
  await expect(page.locator('[data-workflow-step="csv"]')).toHaveClass(/active/);

  const savedBeforeReopen = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
  expect(savedBeforeReopen).toContain('"mode":"custom"');
  expect(savedBeforeReopen).toContain('"workflowStep":"csv"');

  // 同じブラウザコンテキスト内で新しいページを開く。
  // localStorage は維持しつつ DOM は完全に作り直されるため、
  // 実際の「アプリを閉じて開き直す」に近い状態を再現できる。
  const reopenedPage = await context.newPage();
  await page.close();
  await login(reopenedPage, '/index.html?workflow-resume-reopen=1');

  const resumeCard = reopenedPage.locator('.workflow-resume-card');
  await expect(resumeCard).toBeVisible({ timeout: 5000 });
  await expect(resumeCard).toContainText('前回のつづき、覚えています。');
  await expect(resumeCard).toContainText('自作CSV');

  await resumeCard.locator('.workflow-resume-continue').click();

  await expect(reopenedPage.locator('#tool')).toHaveClass(/active/, { timeout: 3000 });
  await expect(reopenedPage.locator('#csvModeSummaryText')).toContainText('自作CSV');
  await expect(reopenedPage.locator('[data-workflow-step="csv"]')).toHaveClass(/active/);
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

  await login(page, '/index.html?workflow-resume-new=1');

  const resumeCard = page.locator('.workflow-resume-card');
  await expect(resumeCard).toBeVisible({ timeout: 5000 });
  await resumeCard.locator('.workflow-resume-new').click();

  await expect(page.locator('#campsiteCsvModal')).toBeVisible();
  const saved = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
  expect(saved).toBeNull();
});
