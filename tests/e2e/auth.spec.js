const { test, expect } = require('@playwright/test');

test.describe('Authentication Flow', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('MordecAI');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('should show validation errors for empty login', async ({ page }) => {
    await page.goto('/');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('.error-message')).toBeVisible();
  });

  test('should attempt login with credentials', async ({ page }) => {
    await page.goto('/');
    
    await page.fill('input[type="email"]', 'test@mordecai.com');
    await page.fill('input[type="password"]', 'testpassword');
    await page.click('button[type="submit"]');
    
    // Should either redirect to dashboard or show error message
    await page.waitForTimeout(2000);
    const url = page.url();
    const hasError = await page.locator('.error-message').isVisible();
    
    expect(url.includes('/dashboard') || hasError).toBe(true);
  });
});