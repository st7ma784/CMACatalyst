const { test, expect } = require('@playwright/test');

test.describe('Comprehensive User Flows', () => {
    let page;

    test.beforeEach(async ({ browser }) => {
        page = await browser.newPage();
        // Go to the application
        await page.goto('/');
    });

    test.afterEach(async () => {
        await page.close();
    });

    test.describe('Authentication Flow', () => {
        test('should complete login flow successfully', async () => {
            // Navigate to login page
            await page.click('text=Login');
            
            // Fill login form
            await page.fill('[data-testid="username"]', 'testuser');
            await page.fill('[data-testid="password"]', 'password123');
            
            // Submit login
            await page.click('[data-testid="login-button"]');
            
            // Verify successful login
            await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
            await expect(page.locator('text=Welcome')).toBeVisible();
        });

        test('should handle invalid credentials', async () => {
            await page.click('text=Login');
            
            await page.fill('[data-testid="username"]', 'invaliduser');
            await page.fill('[data-testid="password"]', 'wrongpassword');
            
            await page.click('[data-testid="login-button"]');
            
            // Verify error message
            await expect(page.locator('.error-message')).toContainText('Invalid credentials');
        });

        test('should logout successfully', async () => {
            // Login first
            await page.click('text=Login');
            await page.fill('[data-testid="username"]', 'testuser');
            await page.fill('[data-testid="password"]', 'password123');
            await page.click('[data-testid="login-button"]');
            
            // Logout
            await page.click('[data-testid="user-menu"]');
            await page.click('text=Logout');
            
            // Verify redirect to login
            await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
        });
    });

    test.describe('Case Management Flow', () => {
        test.beforeEach(async () => {
            // Login before each case management test
            await page.click('text=Login');
            await page.fill('[data-testid="username"]', 'testuser');
            await page.fill('[data-testid="password"]', 'password123');
            await page.click('[data-testid="login-button"]');
            await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
        });

        test('should create new case successfully', async () => {
            // Navigate to cases
            await page.click('[data-testid="nav-cases"]');
            
            // Click create new case
            await page.click('[data-testid="create-case-button"]');
            
            // Fill case form
            await page.fill('[data-testid="client-name"]', 'John Doe');
            await page.fill('[data-testid="client-email"]', 'john.doe@example.com');
            await page.fill('[data-testid="client-phone"]', '+1234567890');
            await page.selectOption('[data-testid="case-type"]', 'debt_advice');
            await page.fill('[data-testid="case-description"]', 'Client needs debt advice and budget planning');
            
            // Submit form
            await page.click('[data-testid="submit-case"]');
            
            // Verify case creation
            await expect(page.locator('.success-message')).toContainText('Case created successfully');
            await expect(page.locator('[data-testid="case-list"]')).toContainText('John Doe');
        });

        test('should view case details', async () => {
            // Navigate to cases
            await page.click('[data-testid="nav-cases"]');
            
            // Click on a case
            await page.click('[data-testid="case-item"]:first-child');
            
            // Verify case details page
            await expect(page.locator('[data-testid="case-details"]')).toBeVisible();
            await expect(page.locator('[data-testid="client-info"]')).toBeVisible();
            await expect(page.locator('[data-testid="case-timeline"]')).toBeVisible();
        });

        test('should update case status', async () => {
            await page.click('[data-testid="nav-cases"]');
            await page.click('[data-testid="case-item"]:first-child');
            
            // Update status
            await page.selectOption('[data-testid="case-status"]', 'in_progress');
            await page.click('[data-testid="update-status-button"]');
            
            // Verify status update
            await expect(page.locator('.success-message')).toContainText('Status updated');
            await expect(page.locator('[data-testid="case-status"]')).toHaveValue('in_progress');
        });

        test('should add case notes', async () => {
            await page.click('[data-testid="nav-cases"]');
            await page.click('[data-testid="case-item"]:first-child');
            
            // Add note
            await page.fill('[data-testid="note-content"]', 'Client called to discuss payment options. Scheduled follow-up for next week.');
            await page.click('[data-testid="add-note-button"]');
            
            // Verify note added
            await expect(page.locator('[data-testid="notes-list"]')).toContainText('Client called to discuss payment options');
        });
    });

    test.describe('Document Management Flow', () => {
        test.beforeEach(async () => {
            // Login
            await page.click('text=Login');
            await page.fill('[data-testid="username"]', 'testuser');
            await page.fill('[data-testid="password"]', 'password123');
            await page.click('[data-testid="login-button"]');
            await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
        });

        test('should upload document successfully', async () => {
            await page.click('[data-testid="nav-cases"]');
            await page.click('[data-testid="case-item"]:first-child');
            
            // Navigate to documents section
            await page.click('[data-testid="case-documents-tab"]');
            
            // Upload file
            const fileInput = page.locator('[data-testid="file-upload"]');
            await fileInput.setInputFiles({
                name: 'test-document.pdf',
                mimeType: 'application/pdf',
                buffer: Buffer.from('Test PDF content')
            });
            
            await page.selectOption('[data-testid="document-category"]', 'income');
            await page.click('[data-testid="upload-button"]');
            
            // Verify upload
            await expect(page.locator('.success-message')).toContainText('Document uploaded successfully');
            await expect(page.locator('[data-testid="document-list"]')).toContainText('test-document.pdf');
        });

        test('should view document details', async () => {
            await page.click('[data-testid="nav-cases"]');
            await page.click('[data-testid="case-item"]:first-child');
            await page.click('[data-testid="case-documents-tab"]');
            
            // Click on document
            await page.click('[data-testid="document-item"]:first-child');
            
            // Verify document viewer
            await expect(page.locator('[data-testid="document-viewer"]')).toBeVisible();
            await expect(page.locator('[data-testid="document-metadata"]')).toBeVisible();
        });

        test('should search documents', async () => {
            await page.click('[data-testid="nav-cases"]');
            await page.click('[data-testid="case-item"]:first-child');
            await page.click('[data-testid="case-documents-tab"]');
            
            // Search documents
            await page.fill('[data-testid="document-search"]', 'bank statement');
            await page.press('[data-testid="document-search"]', 'Enter');
            
            // Verify search results
            await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
        });
    });

    test.describe('Appointment Scheduling Flow', () => {
        test.beforeEach(async () => {
            // Login
            await page.click('text=Login');
            await page.fill('[data-testid="username"]', 'testuser');
            await page.fill('[data-testid="password"]', 'password123');
            await page.click('[data-testid="login-button"]');
            await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
        });

        test('should schedule new appointment', async () => {
            await page.click('[data-testid="nav-appointments"]');
            
            // Click schedule appointment
            await page.click('[data-testid="schedule-appointment-button"]');
            
            // Fill appointment form
            await page.selectOption('[data-testid="client-select"]', '1'); // Assume client ID 1
            await page.fill('[data-testid="appointment-date"]', '2024-02-15');
            await page.fill('[data-testid="appointment-time"]', '10:00');
            await page.selectOption('[data-testid="appointment-type"]', 'consultation');
            await page.fill('[data-testid="appointment-notes"]', 'Initial consultation for debt advice');
            
            await page.click('[data-testid="schedule-button"]');
            
            // Verify appointment scheduled
            await expect(page.locator('.success-message')).toContainText('Appointment scheduled successfully');
            await expect(page.locator('[data-testid="calendar"]')).toContainText('Initial consultation');
        });

        test('should view calendar', async () => {
            await page.click('[data-testid="nav-appointments"]');
            
            // Verify calendar is visible
            await expect(page.locator('[data-testid="calendar"]')).toBeVisible();
            
            // Test calendar navigation
            await page.click('[data-testid="next-month"]');
            await page.click('[data-testid="prev-month"]');
        });

        test('should reschedule appointment', async () => {
            await page.click('[data-testid="nav-appointments"]');
            
            // Click on existing appointment
            await page.click('[data-testid="appointment-item"]:first-child');
            
            // Reschedule
            await page.click('[data-testid="reschedule-button"]');
            await page.fill('[data-testid="new-appointment-date"]', '2024-02-20');
            await page.fill('[data-testid="new-appointment-time"]', '14:00');
            await page.click('[data-testid="confirm-reschedule"]');
            
            // Verify reschedule
            await expect(page.locator('.success-message')).toContainText('Appointment rescheduled');
        });
    });

    test.describe('Workflow and AI Features Flow', () => {
        test.beforeEach(async () => {
            // Login
            await page.click('text=Login');
            await page.fill('[data-testid="username"]', 'testuser');
            await page.fill('[data-testid="password"]', 'password123');
            await page.click('[data-testid="login-button"]');
            await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
        });

        test('should access agentic workflow features', async () => {
            await page.click('[data-testid="nav-cases"]');
            await page.click('[data-testid="case-item"]:first-child');
            
            // Navigate to workflow tab
            await page.click('[data-testid="case-workflow-tab"]');
            
            // Verify workflow interface
            await expect(page.locator('[data-testid="workflow-templates"]')).toBeVisible();
            await expect(page.locator('[data-testid="ai-assistant"]')).toBeVisible();
        });

        test('should generate case summary using AI', async () => {
            await page.click('[data-testid="nav-cases"]');
            await page.click('[data-testid="case-item"]:first-child');
            
            // Generate AI summary (mock functionality)
            await page.click('[data-testid="generate-summary-button"]');
            
            // Wait for AI response (simulate)
            await page.waitForTimeout(2000);
            
            // Verify summary generated
            await expect(page.locator('[data-testid="ai-summary"]')).toBeVisible();
        });

        test('should use document OCR feature', async () => {
            await page.click('[data-testid="nav-cases"]');
            await page.click('[data-testid="case-item"]:first-child');
            await page.click('[data-testid="case-documents-tab"]');
            
            // Upload document for OCR
            const fileInput = page.locator('[data-testid="ocr-file-upload"]');
            await fileInput.setInputFiles({
                name: 'scanned-document.pdf',
                mimeType: 'application/pdf',
                buffer: Buffer.from('Scanned document content')
            });
            
            await page.click('[data-testid="process-ocr-button"]');
            
            // Wait for OCR processing
            await page.waitForTimeout(3000);
            
            // Verify OCR results
            await expect(page.locator('[data-testid="ocr-results"]')).toBeVisible();
        });
    });

    test.describe('Responsive Design Tests', () => {
        test('should work on mobile devices', async ({ browser }) => {
            const context = await browser.newContext({
                viewport: { width: 375, height: 667 } // iPhone SE size
            });
            const mobilePage = await context.newPage();
            
            await mobilePage.goto('/');
            
            // Test mobile navigation
            await mobilePage.click('[data-testid="mobile-menu-toggle"]');
            await expect(mobilePage.locator('[data-testid="mobile-menu"]')).toBeVisible();
            
            // Test mobile login
            await mobilePage.click('text=Login');
            await mobilePage.fill('[data-testid="username"]', 'testuser');
            await mobilePage.fill('[data-testid="password"]', 'password123');
            await mobilePage.click('[data-testid="login-button"]');
            
            await expect(mobilePage.locator('[data-testid="dashboard"]')).toBeVisible();
            
            await context.close();
        });

        test('should work on tablet devices', async ({ browser }) => {
            const context = await browser.newContext({
                viewport: { width: 768, height: 1024 } // iPad size
            });
            const tabletPage = await context.newPage();
            
            await tabletPage.goto('/');
            
            // Verify tablet layout
            await expect(tabletPage.locator('[data-testid="sidebar"]')).toBeVisible();
            await expect(tabletPage.locator('[data-testid="main-content"]')).toBeVisible();
            
            await context.close();
        });
    });

    test.describe('Error Handling and Edge Cases', () => {
        test('should handle network errors gracefully', async () => {
            // Simulate network error
            await page.route('**/api/**', route => {
                route.abort('failed');
            });
            
            await page.click('text=Login');
            await page.fill('[data-testid="username"]', 'testuser');
            await page.fill('[data-testid="password"]', 'password123');
            await page.click('[data-testid="login-button"]');
            
            // Verify error message
            await expect(page.locator('[data-testid="error-message"]')).toContainText('Network error');
        });

        test('should handle server errors', async () => {
            // Simulate server error
            await page.route('**/api/**', route => {
                route.fulfill({
                    status: 500,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'Internal server error' })
                });
            });
            
            await page.goto('/');
            
            // Verify error page or message
            await expect(page.locator('[data-testid="server-error"]')).toBeVisible();
        });

        test('should handle session timeout', async () => {
            // Login first
            await page.click('text=Login');
            await page.fill('[data-testid="username"]', 'testuser');
            await page.fill('[data-testid="password"]', 'password123');
            await page.click('[data-testid="login-button"]');
            
            // Simulate expired token
            await page.route('**/api/**', route => {
                route.fulfill({
                    status: 401,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'Token expired' })
                });
            });
            
            // Try to access protected resource
            await page.click('[data-testid="nav-cases"]');
            
            // Verify redirect to login
            await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
            await expect(page.locator('[data-testid="session-expired-message"]')).toBeVisible();
        });
    });
});