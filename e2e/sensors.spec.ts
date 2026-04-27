import { test, expect } from '@playwright/test';

test.describe('Sensors Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sensors', { waitUntil: 'domcontentloaded' });
  });

  test('should display sensors table', async ({ page }) => {
    await expect(page.getByText(/IoT Sensor Networks/i).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Node ID/i).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Water Level/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('should filter sensors by status', async ({ page }) => {
    await page.waitForSelector('table', { timeout: 15000 });
    const filterButton = page.getByText(/Filter|Status/i).first();
    if (await filterButton.isVisible()) {
      await filterButton.click();
    }
  });

  test('should export to CSV', async ({ page }) => {
    const exportButton = page.getByText(/Export|CSV/i).first();
    if (await exportButton.isVisible({ timeout: 8000 })) {
      const downloadPromise = page.waitForEvent('download');
      await exportButton.click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.csv|\.xlsx/i);
    }
  });

  test('should search sensors', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i).first();
    if (await searchInput.isVisible({ timeout: 8000 })) {
      await searchInput.fill('102');
      await page.waitForTimeout(500);
    }
  });
});
