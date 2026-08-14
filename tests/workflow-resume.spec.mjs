import { test, expect } from '@playwright/test';

const STORAGE_KEY = 'campsiteWorkflowResumeV1';

test('旧つづきデータが残っていてもカードを表示せず保存状態を削除する', async ({ page }) => {
  await page.addInitScript(key => {
    localStorage.setItem(key, JSON.stringify({
      version: 1,
      mode: 'custom',
      workflowStep: 'csv',
      lastTab: 'tool',
      updatedAt: Date.now()
    }));
  }, STORAGE_KEY);

  await page.goto('/index.html?workflow-resume-disabled=1');

  await expect(page.locator('.workflow-resume-card')).toHaveCount(0);

  await expect.poll(async () => {
    return page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
  }).toBeNull();
});

test('旧workflow-resume.jsが読み込まれてもカードと保存状態を掃除する', async ({ page }) => {
  await page.goto('/index.html?workflow-resume-legacy-cleanup=1');

  await page.evaluate(key => {
    localStorage.setItem(key, JSON.stringify({
      version: 1,
      mode: 'extracted',
      workflowStep: 'distance',
      lastTab: 'distance',
      updatedAt: Date.now()
    }));

    const card = document.createElement('div');
    card.className = 'workflow-resume-card';
    card.textContent = '前回のつづき';
    document.body.appendChild(card);

    const script = document.createElement('script');
    script.src = '/js/workflow-resume.js?legacy-cleanup-test=1';
    document.head.appendChild(script);
  }, STORAGE_KEY);

  await expect(page.locator('.workflow-resume-card')).toHaveCount(0);

  const saved = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
  expect(saved).toBeNull();
});
