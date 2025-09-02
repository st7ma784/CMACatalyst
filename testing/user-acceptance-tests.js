// CMA System User Acceptance Tests
// Comprehensive UAT suite covering all major user workflows

const { test, expect } = require('@playwright/test');

// Test Configuration
const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const TEST_USERS = {
  manager: { username: 'test_manager', password: 'test123' },
  advisor: { username: 'test_advisor', password: 'test123' }
};

// Helper Functions
async function login(page, userType) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('[name="username"]', TEST_USERS[userType].username);
  await page.fill('[name="password"]', TEST_USERS[userType].password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/`);
}

async function createTestClient(page) {
  await page.click('text=Add Client');
  await page.fill('[name="first_name"]', 'John');
  await page.fill('[name="last_name"]', 'Doe');
  await page.fill('[name="email"]', 'john.doe@test.com');
  await page.fill('[name="phone"]', '07700123456');
  await page.fill('[name="address"]', '123 Test Street, Test City');
  await page.fill('[name="date_of_birth"]', '1980-01-01');
  await page.click('text=Save');
  await page.waitForSelector('text=Client created successfully');
}

// Authentication Tests
test.describe('Authentication & Authorization', () => {
  test('Manager can login and access all features', async ({ page }) => {
    await login(page, 'manager');
    
    // Verify dashboard access
    await expect(page.locator('h4')).toContainText('Welcome back');
    
    // Verify manager-only features are visible
    await expect(page.locator('text=User Management')).toBeVisible();
    await expect(page.locator('text=Auto Actions')).toBeVisible();
    await expect(page.locator('text=Branding')).toBeVisible();
  });

  test('Advisor can login with limited access', async ({ page }) => {
    await login(page, 'advisor');
    
    // Verify dashboard access
    await expect(page.locator('h4')).toContainText('Welcome back');
    
    // Verify manager-only features are hidden
    await expect(page.locator('text=User Management')).not.toBeVisible();
    await expect(page.locator('text=Auto Actions')).not.toBeVisible();
  });

  test('Invalid credentials show error message', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('[name="username"]', 'invalid_user');
    await page.fill('[name="password"]', 'wrong_password');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('.MuiAlert-message')).toContainText('Invalid credentials');
  });
});

// Client Management Tests
test.describe('Client Management Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'advisor');
    await page.click('text=Clients');
  });

  test('Create new client with complete information', async ({ page }) => {
    await createTestClient(page);
    
    // Verify client appears in list
    await expect(page.locator('text=John Doe')).toBeVisible();
    await expect(page.locator('text=john.doe@test.com')).toBeVisible();
  });

  test('Search and filter clients', async ({ page }) => {
    // Create test client first
    await createTestClient(page);
    
    // Test search functionality
    await page.fill('[placeholder="Search clients..."]', 'John');
    await expect(page.locator('text=John Doe')).toBeVisible();
    
    // Test search with no results
    await page.fill('[placeholder="Search clients..."]', 'NonExistent');
    await expect(page.locator('text=No clients found')).toBeVisible();
  });

  test('View client details and edit information', async ({ page }) => {
    await createTestClient(page);
    
    // Click on client to view details
    await page.click('text=John Doe');
    
    // Verify client details page
    await expect(page.locator('h4')).toContainText('John Doe');
    await expect(page.locator('text=john.doe@test.com')).toBeVisible();
    
    // Test editing client information
    await page.click('text=Edit Client');
    await page.fill('[name="phone"]', '07700654321');
    await page.click('text=Save Changes');
    
    await expect(page.locator('text=07700654321')).toBeVisible();
  });
});

// Case Management Tests
test.describe('Case Management Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'advisor');
  });

  test('Create new case for existing client', async ({ page }) => {
    // First create a client
    await page.click('text=Clients');
    await createTestClient(page);
    
    // Navigate to cases
    await page.click('text=Cases');
    await page.click('text=Add Case');
    
    // Fill case details
    await page.selectOption('[name="client_id"]', { label: 'John Doe' });
    await page.fill('[name="case_number"]', 'CASE001');
    await page.selectOption('[name="debt_stage"]', 'Assessment');
    await page.selectOption('[name="priority"]', 'medium');
    await page.click('text=Create Case');
    
    // Verify case creation
    await expect(page.locator('text=Case created successfully')).toBeVisible();
    await expect(page.locator('text=CASE001')).toBeVisible();
  });

  test('Add notes and files to case', async ({ page }) => {
    // Assume case exists, navigate to case detail
    await page.click('text=Cases');
    await page.click('text=CASE001');
    
    // Add a note
    await page.click('text=Add Note');
    await page.fill('[name="content"]', 'Initial assessment completed');
    await page.selectOption('[name="category"]', 'Assessment');
    await page.click('text=Save Note');
    
    await expect(page.locator('text=Initial assessment completed')).toBeVisible();
    
    // Test file upload
    await page.click('text=Upload File');
    await page.setInputFiles('[type="file"]', 'test-document.pdf');
    await page.fill('[name="description"]', 'Bank statements');
    await page.click('text=Upload');
    
    await expect(page.locator('text=File uploaded successfully')).toBeVisible();
  });
});

// Appointment Management Tests
test.describe('Appointment Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'advisor');
    await page.click('text=Calendar');
  });

  test('Schedule new appointment', async ({ page }) => {
    await page.click('text=Add Appointment');
    
    // Fill appointment details
    await page.fill('[name="title"]', 'Initial Consultation');
    await page.selectOption('[name="client_id"]', { label: 'John Doe' });
    await page.fill('[name="appointment_date"]', '2024-01-15');
    await page.fill('[name="appointment_time"]', '10:00');
    await page.fill('[name="duration"]', '60');
    await page.fill('[name="notes"]', 'First meeting to discuss debt situation');
    
    await page.click('text=Schedule Appointment');
    
    // Verify appointment creation
    await expect(page.locator('text=Appointment scheduled successfully')).toBeVisible();
    await expect(page.locator('text=Initial Consultation')).toBeVisible();
  });

  test('View and manage appointments in calendar', async ({ page }) => {
    // Verify calendar view
    await expect(page.locator('.calendar-container')).toBeVisible();
    
    // Test different calendar views
    await page.click('text=Month');
    await expect(page.locator('.month-view')).toBeVisible();
    
    await page.click('text=Week');
    await expect(page.locator('.week-view')).toBeVisible();
    
    await page.click('text=Day');
    await expect(page.locator('.day-view')).toBeVisible();
  });
});

// AI Workflow Tests
test.describe('AI Workflow Automation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'advisor');
    await page.click('text=AI Workflows');
  });

  test('Execute comprehensive case review workflow', async ({ page }) => {
    // Select workflow template
    await page.click('text=Comprehensive Case Review');
    
    // Select a case
    await page.selectOption('[name="case_id"]', { label: 'CASE001 - John Doe' });
    
    // Execute workflow
    await page.click('text=Execute Workflow');
    
    // Wait for workflow completion
    await page.waitForSelector('text=Workflow completed successfully', { timeout: 30000 });
    
    // Verify results
    await expect(page.locator('text=Risk Assessment')).toBeVisible();
    await expect(page.locator('text=Recommendations')).toBeVisible();
    await expect(page.locator('text=Generated Documents')).toBeVisible();
  });

  test('Generate debt solution comparison', async ({ page }) => {
    await page.click('text=Debt Solution Comparison');
    await page.selectOption('[name="case_id"]', { label: 'CASE001 - John Doe' });
    await page.click('text=Execute Workflow');
    
    await page.waitForSelector('text=Workflow completed successfully', { timeout: 30000 });
    
    // Verify debt solutions are presented
    await expect(page.locator('text=Debt Management Plan')).toBeVisible();
    await expect(page.locator('text=Individual Voluntary Arrangement')).toBeVisible();
    await expect(page.locator('text=Affordability Analysis')).toBeVisible();
  });
});

// Document Management Tests
test.describe('Document Management & OCR', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'advisor');
  });

  test('Upload and process document with OCR', async ({ page }) => {
    await page.click('text=Cases');
    await page.click('text=CASE001');
    await page.click('text=Document OCR');
    
    // Upload document for OCR processing
    await page.setInputFiles('[type="file"]', 'sample-bank-statement.pdf');
    await page.click('text=Process with OCR');
    
    // Wait for OCR processing
    await page.waitForSelector('text=OCR processing completed', { timeout: 60000 });
    
    // Verify extracted data
    await expect(page.locator('text=Extracted Text')).toBeVisible();
    await expect(page.locator('text=Account Balance')).toBeVisible();
  });

  test('Organize documents in case filestore', async ({ page }) => {
    await page.click('text=Cases');
    await page.click('text=CASE001');
    await page.click('text=Case Filestore');
    
    // Create folder structure
    await page.click('text=Create Folder');
    await page.fill('[name="folder_name"]', 'Bank Statements');
    await page.click('text=Create');
    
    // Upload document to folder
    await page.click('text=Bank Statements');
    await page.click('text=Upload Document');
    await page.setInputFiles('[type="file"]', 'bank-statement.pdf');
    await page.fill('[name="description"]', 'Monthly bank statement');
    await page.click('text=Upload');
    
    await expect(page.locator('text=Document uploaded successfully')).toBeVisible();
  });
});

// Reporting and Analytics Tests
test.describe('Reporting & Analytics', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'manager');
  });

  test('Generate case statistics report', async ({ page }) => {
    await page.click('text=Dashboard');
    
    // Verify dashboard statistics
    await expect(page.locator('text=Active Cases')).toBeVisible();
    await expect(page.locator('text=Total Clients')).toBeVisible();
    await expect(page.locator('text=Upcoming Appointments')).toBeVisible();
    await expect(page.locator('text=Total Debt Managed')).toBeVisible();
    
    // Test clicking on statistics cards
    await page.click('text=Active Cases');
    await expect(page.url()).toContain('/cases');
  });

  test('Export data functionality', async ({ page }) => {
    await page.click('text=Cases');
    
    // Test export functionality
    await page.click('text=Export');
    await page.click('text=Export to Excel');
    
    // Verify download initiated
    const downloadPromise = page.waitForEvent('download');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.xlsx');
  });
});

// Mobile Responsiveness Tests
test.describe('Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE size

  test('Mobile navigation works correctly', async ({ page }) => {
    await login(page, 'advisor');
    
    // Test mobile menu
    await page.click('[aria-label="open drawer"]');
    await expect(page.locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('text=Clients')).toBeVisible();
    
    // Test navigation
    await page.click('text=Clients');
    await expect(page.url()).toContain('/clients');
  });

  test('Forms are usable on mobile', async ({ page }) => {
    await login(page, 'advisor');
    await page.click('text=Clients');
    await page.click('text=Add Client');
    
    // Verify form is properly displayed on mobile
    await expect(page.locator('[name="first_name"]')).toBeVisible();
    await expect(page.locator('[name="last_name"]')).toBeVisible();
    
    // Test form submission on mobile
    await createTestClient(page);
    await expect(page.locator('text=Client created successfully')).toBeVisible();
  });
});

// Performance Tests
test.describe('Performance & Loading', () => {
  test('Dashboard loads within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    await login(page, 'advisor');
    const loadTime = Date.now() - startTime;
    
    // Dashboard should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
    
    // Verify all dashboard elements are loaded
    await expect(page.locator('text=Welcome back')).toBeVisible();
    await expect(page.locator('text=Active Cases')).toBeVisible();
  });

  test('Large client list loads efficiently', async ({ page }) => {
    await login(page, 'advisor');
    await page.click('text=Clients');
    
    // Verify pagination or virtual scrolling works
    await expect(page.locator('[data-testid="client-card"]')).toHaveCount({ min: 1 });
    
    // Test search performance
    const searchStart = Date.now();
    await page.fill('[placeholder="Search clients..."]', 'test');
    await page.waitForTimeout(500); // Allow for debouncing
    const searchTime = Date.now() - searchStart;
    
    expect(searchTime).toBeLessThan(1000);
  });
});

// Error Handling Tests
test.describe('Error Handling & Recovery', () => {
  test('Handles network errors gracefully', async ({ page }) => {
    await login(page, 'advisor');
    
    // Simulate network failure
    await page.route('**/api/**', route => route.abort());
    
    await page.click('text=Clients');
    
    // Verify error message is displayed
    await expect(page.locator('text=Unable to load data')).toBeVisible();
    
    // Test retry functionality
    await page.unroute('**/api/**');
    await page.click('text=Retry');
    
    await expect(page.locator('[data-testid="client-card"]')).toBeVisible();
  });

  test('Form validation prevents invalid submissions', async ({ page }) => {
    await login(page, 'advisor');
    await page.click('text=Clients');
    await page.click('text=Add Client');
    
    // Try to submit empty form
    await page.click('text=Save');
    
    // Verify validation errors
    await expect(page.locator('text=First name is required')).toBeVisible();
    await expect(page.locator('text=Last name is required')).toBeVisible();
    await expect(page.locator('text=Email is required')).toBeVisible();
  });
});

// Accessibility Tests
test.describe('Accessibility Compliance', () => {
  test('Keyboard navigation works throughout the app', async ({ page }) => {
    await login(page, 'advisor');
    
    // Test tab navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    
    // Verify navigation worked
    await expect(page.url()).toContain('/clients');
  });

  test('Screen reader compatibility', async ({ page }) => {
    await login(page, 'advisor');
    
    // Verify ARIA labels and roles are present
    await expect(page.locator('[role="navigation"]')).toBeVisible();
    await expect(page.locator('[aria-label="account of current user"]')).toBeVisible();
    
    // Test form labels
    await page.click('text=Clients');
    await page.click('text=Add Client');
    
    await expect(page.locator('label[for="first_name"]')).toBeVisible();
    await expect(page.locator('label[for="last_name"]')).toBeVisible();
  });
});
