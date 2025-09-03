const { test, expect } = require('@playwright/test');

test.describe('Dashboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Mock login by setting localStorage
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('authToken', 'mock-token');
      localStorage.setItem('user', JSON.stringify({
        id: 1,
        name: 'Test User',
        role: 'advisor'
      }));
    });
  });

  test('should display dashboard with navigation', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Check main navigation elements
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('text=Cases')).toBeVisible();
    await expect(page.locator('text=Clients')).toBeVisible();
    await expect(page.locator('text=Documents')).toBeVisible();
  });

  test('should navigate to case list', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click('text=Cases');
    
    await expect(page.url()).toContain('/cases');
    await expect(page.locator('h1, h2, h3')).toContainText(/Cases|Case List/i);
  });

  test('should navigate to client list', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click('text=Clients');
    
    await expect(page.url()).toContain('/clients');
    await expect(page.locator('h1, h2, h3')).toContainText(/Clients|Client List/i);
  });

  test('should display document upload section', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Look for document-related functionality
    const documentSection = page.locator('text=Document').first();
    if (await documentSection.isVisible()) {
      await documentSection.click();
      await expect(page.locator('input[type="file"], .file-upload')).toBeVisible();
    }
  });
});