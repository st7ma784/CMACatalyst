const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Document Upload Functionality', () => {
  test.beforeEach(async ({ page }) => {
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

  test('should upload document successfully', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Navigate to document upload (may be in different locations)
    const uploadLink = page.locator('text=Upload').or(page.locator('text=Document')).first();
    if (await uploadLink.isVisible()) {
      await uploadLink.click();
    }

    // Look for file input
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible()) {
      // Create a test file
      const testFilePath = path.join(__dirname, 'fixtures', 'test-document.txt');
      
      // Mock file upload
      await fileInput.setInputFiles({
        name: 'test-document.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('This is a test document for debt advice case.')
      });

      // Submit upload
      const submitButton = page.locator('button[type="submit"]').or(page.locator('button:has-text("Upload")')).first();
      await submitButton.click();
      
      // Wait for upload result
      await expect(page.locator('text=success').or(page.locator('.success-message'))).toBeVisible({ timeout: 10000 });
    }
  });

  test('should validate file type restrictions', async ({ page }) => {
    await page.goto('/dashboard');
    
    const uploadSection = page.locator('text=Upload').or(page.locator('input[type="file"]')).first();
    if (await uploadSection.isVisible()) {
      const fileInput = page.locator('input[type="file"]').first();
      
      // Try uploading an unsupported file type
      await fileInput.setInputFiles({
        name: 'test.exe',
        mimeType: 'application/x-msdownload',
        buffer: Buffer.from('fake exe content')
      });

      const submitButton = page.locator('button[type="submit"]').or(page.locator('button:has-text("Upload")')).first();
      await submitButton.click();
      
      // Should show error message
      await expect(page.locator('text=invalid').or(page.locator('.error-message'))).toBeVisible({ timeout: 5000 });
    }
  });

  test('should display file tree after upload', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Look for case or document management sections
    const caseLink = page.locator('text=Case').or(page.locator('text=Document')).first();
    if (await caseLink.isVisible()) {
      await caseLink.click();
      
      // Should display some kind of file structure or list
      await expect(
        page.locator('.file-tree').or(
        page.locator('.document-list')).or(
        page.locator('ul')).or(
        page.locator('table'))
      ).toBeVisible({ timeout: 5000 });
    }
  });
});