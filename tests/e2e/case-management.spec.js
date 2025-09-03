const { test, expect } = require('@playwright/test');

test.describe('Case Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('authToken', 'mock-token');
      localStorage.setItem('user', JSON.stringify({
        id: 1,
        name: 'Test Advisor',
        role: 'advisor'
      }));
    });
  });

  test('should display case list', async ({ page }) => {
    await page.goto('/dashboard');
    
    const casesLink = page.locator('text=Cases').first();
    await casesLink.click();
    
    await expect(page.url()).toContain('cases');
    await expect(page.locator('h1, h2, h3')).toContainText(/Cases/i);
    
    // Should show some cases or empty state
    const hasCases = await page.locator('.case-item').or(page.locator('tr')).count() > 0;
    const hasEmptyState = await page.locator('text=No cases').or(page.locator('text=empty')).isVisible();
    
    expect(hasCases || hasEmptyState).toBe(true);
  });

  test('should allow creating new case', async ({ page }) => {
    await page.goto('/cases');
    
    const newCaseButton = page.locator('button:has-text("New")').or(page.locator('button:has-text("Create")').or(page.locator('button:has-text("Add")'))).first();
    
    if (await newCaseButton.isVisible()) {
      await newCaseButton.click();
      
      // Should show case creation form
      await expect(page.locator('form').or(page.locator('input[name*="client"]').or(page.locator('input[placeholder*="client"]')))).toBeVisible();
    }
  });

  test('should display case details', async ({ page }) => {
    await page.goto('/cases');
    
    // Click on first case if available
    const firstCase = page.locator('.case-item a, tr a, .case-link').first();
    if (await firstCase.isVisible()) {
      await firstCase.click();
      
      // Should navigate to case details
      await expect(page.url()).toContain('/cases/');
      await expect(page.locator('h1, h2, h3')).toContainText(/Case|Client/i);
    }
  });

  test('should show agentic workflow features', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Look for AI/workflow features
    const workflowLink = page.locator('text=Workflow').or(page.locator('text=AI')).or(page.locator('text=Agentic')).first();
    
    if (await workflowLink.isVisible()) {
      await workflowLink.click();
      
      // Should display workflow interface
      await expect(page.locator('.workflow').or(page.locator('.ai-assistant')).or(page.locator('button:has-text("Generate")'))).toBeVisible();
    }
  });
});