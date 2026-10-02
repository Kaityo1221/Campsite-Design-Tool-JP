import { expect } from '@playwright/test';

export async function startPoiAdd(page) {
  const launcher = page.locator('#fieldModeCreativeButton');
  await expect(launcher).toHaveAttribute('aria-label', '候補地を追加');
  await launcher.click();
  await expect.poll(() => page.evaluate(() => window.FieldCreative?.activeTool?.())).toBe('poi');
  await expect(page.locator('#fieldModeCreativeHotbar')).not.toHaveClass(/is-open/);
  await expect(page.locator('#fieldModeNewPoiButton')).toBeVisible();
  await expect(page.locator('#fieldModeNewPoiButton')).toContainText('この位置に設置');
  await expect(page.locator('#fieldModeCrosshair')).toBeVisible();
}

export async function openLegacyTools(page) {
  const launcher = page.locator('#fieldModeCreativeButton');
  await expect(launcher).toHaveAttribute('aria-label', '候補地を追加');
  await expect(launcher).toBeEnabled();
  await launcher.hover();
  await page.mouse.down();
  try {
    // The v2 launcher opens legacy tools after a 650 ms hold.
    await page.waitForTimeout(700);
  } finally {
    await page.mouse.up();
  }
  await expect(page.locator('#fieldModeCreativeHotbar')).toHaveClass(/is-open/);
  await expect.poll(() => page.evaluate(() => window.FieldCreative?.activeTool?.())).toBe(null);
}
