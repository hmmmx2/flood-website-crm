import { test, expect } from '@playwright/test';

const COMMUNITY_LOGIN = 'http://localhost:3002/login';

// ── Unauthenticated tests — clear storage state ───────────────────────────────
test.describe('Authentication Flow — Unauthenticated', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('should redirect /login to community login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(COMMUNITY_LOGIN, { timeout: 8000 });
  });

  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
  });

  test('should show error for invalid credentials on community login', async ({ page }) => {
    await page.goto(COMMUNITY_LOGIN, { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="email"]', 'nobody@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    // Wait for the error banner — identified by its red border inline style
    await expect(
      page.locator('[style*="rgba(237,28,36"]')
    ).toBeVisible({ timeout: 20000 });
  });
});

// ── Authenticated tests — uses default storageState (.auth-state.json) ────────
test.describe('Authentication Flow — Authenticated', () => {
  test('should access dashboard when authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 8000 });
    await expect(page.getByText(/dashboard/i).first()).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 8000 });

    await page.getByText(/Alwin|Admin/i).first().click();
    await page.getByText(/Logout/i).click();

    await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
  });
});
