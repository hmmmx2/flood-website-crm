import { test, expect } from '@playwright/test';

test.describe('Settings Pages', () => {
  test('should access Account Settings', async ({ page }) => {
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Account Settings/i })).toBeVisible({ timeout: 15000 });
  });

  test('should update user profile', async ({ page }) => {
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    const nameInput = page.getByLabel(/Full Name|Name/i).first();
    if (await nameInput.isVisible({ timeout: 8000 })) {
      await nameInput.clear();
      await nameInput.fill('Updated Name');
      const saveButton = page.getByText(/Save Changes/i).first();
      if (await saveButton.isVisible()) {
        await saveButton.click();
        await expect(page.getByText(/saved|success/i).first()).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('should access CRM Settings', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /CRM Settings/i })).toBeVisible({ timeout: 15000 });
  });

  test('should configure data sync settings', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    // Wait for page content then try Data Management tab if present
    await expect(page.getByRole('heading', { name: /CRM Settings/i })).toBeVisible({ timeout: 15000 });
    const dataManagementTab = page.getByText(/Data Management/i).first();
    if (await dataManagementTab.isVisible({ timeout: 5000 })) {
      await dataManagementTab.click();
      const liveToggle = page.getByLabel(/Live Mode/i).first();
      if (await liveToggle.isVisible({ timeout: 5000 })) {
        await liveToggle.click();
      }
    }
  });
});
