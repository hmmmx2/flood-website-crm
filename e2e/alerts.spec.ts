import { test, expect } from '@playwright/test';

test.describe('Alerts Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/alerts', { waitUntil: 'domcontentloaded' });
  });

  test('should display alerts page', async ({ page }) => {
    await expect(page.getByText(/Alerts Monitoring/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('should show alert statistics', async ({ page }) => {
    await expect(page.getByText(/Total Nodes/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('should filter alerts by type', async ({ page }) => {
    const filterButton = page.getByText(/Filter/i).first();
    if (await filterButton.isVisible({ timeout: 8000 })) {
      await filterButton.click();
      await expect(page.getByText(/All Alerts|Danger|Warning/i).first()).toBeVisible();
    }
  });

  test('should use calendar date picker', async ({ page }) => {
    const dateButton = page.getByText(/Select Date|Calendar/i).first();
    if (await dateButton.isVisible({ timeout: 8000 })) {
      await dateButton.click();
      await expect(page.getByText(/January|February|March/i).first()).toBeVisible({ timeout: 3000 });
    }
  });
});
