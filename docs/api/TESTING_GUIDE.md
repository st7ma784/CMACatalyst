# Testing Guide

This document provides comprehensive information about testing in the MordecAI Advisor Tool system.

## Table of Contents

1. [Testing Strategy](#testing-strategy)
2. [Test Types](#test-types)
3. [Running Tests](#running-tests)
4. [Writing Tests](#writing-tests)
5. [Coverage Requirements](#coverage-requirements)
6. [CI/CD Integration](#cicd-integration)
7. [Troubleshooting](#troubleshooting)

## Testing Strategy

Our testing strategy follows the testing pyramid approach:

```
       /\
      /E2E\     <- End-to-End Tests (Few)
     /____\
    /      \
   /        \
  /Integration\ <- Integration Tests (Some)
 /____________\
/              \
/   Unit Tests  \ <- Unit Tests (Many)
/________________\
```

### Test Distribution
- **Unit Tests**: ~70% of all tests
- **Integration Tests**: ~20% of all tests
- **E2E Tests**: ~10% of all tests

## Test Types

### 1. Unit Tests

Unit tests test individual components, functions, and modules in isolation.

**Location**: 
- Server: `server/__tests__/`
- Client: `client/src/__tests__/`
- Services: `services/*/tests/` or `services/*/__tests__/`

**Technologies Used**:
- **JavaScript/Node.js**: Jest + Supertest
- **React**: Jest + React Testing Library
- **Python**: pytest

**Example Structure**:
```javascript
// server/__tests__/routes-auth.test.js
describe('Auth Routes', () => {
  describe('POST /api/auth/login', () => {
    it('should login user with valid credentials', async () => {
      // Test implementation
    });
    
    it('should reject invalid credentials', async () => {
      // Test implementation
    });
  });
});
```

### 2. Integration Tests

Integration tests verify that different components work together correctly.

**Location**: `tests/integration/`

**Coverage**:
- API endpoint integration
- Database operations
- Service-to-service communication
- External API integrations

### 3. End-to-End (E2E) Tests

E2E tests validate complete user workflows from frontend to backend.

**Location**: `tests/e2e/`

**Technology**: Playwright

**Coverage**:
- User authentication flows
- Case management workflows
- Document upload and processing
- Appointment scheduling
- UI responsiveness across devices

## Running Tests

### Prerequisites

```bash
# Install dependencies
npm ci
cd client && npm ci
cd ../services/document-inbox && npm ci
cd ../ocr-processor && npm ci
cd ../translation-service && pip install -r requirements-dev.txt
```

### Individual Test Suites

```bash
# Run all server tests
npm run test:server

# Run all client tests
npm run test:client

# Run specific test file
npx jest server/__tests__/routes-auth.test.js

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

### Microservices Tests

```bash
# Test individual services
npm run test:services

# Test specific service
cd services/document-inbox && npm test
cd services/ocr-processor && npm test
cd services/translation-service && python -m pytest
```

### Integration Tests

```bash
# Run integration tests
npm run test:integration

# Run with database setup
DATABASE_URL=postgresql://testuser:testpass@localhost:5432/testdb npm run test:integration
```

### E2E Tests

```bash
# Run Playwright tests
npm run test:e2e

# Run with UI mode
npm run test:e2e:ui

# Run specific test file
npx playwright test tests/e2e/auth.spec.js

# Run tests in specific browser
npx playwright test --project=chromium
```

### All Tests

```bash
# Run comprehensive test suite
npm run test:all

# Or use the automated script
./scripts/run-all-tests.sh
```

## Writing Tests

### Unit Test Guidelines

1. **Test Structure**: Follow AAA pattern (Arrange, Act, Assert)
2. **Descriptive Names**: Use clear, descriptive test names
3. **Single Responsibility**: Each test should verify one specific behavior
4. **Mock Dependencies**: Mock external dependencies and services
5. **Test Edge Cases**: Include tests for error conditions and edge cases

### Example Unit Test

```javascript
// server/__tests__/services-caseFilestore.test.js
const caseFilestoreService = require('../services/caseFilestore');
const pool = require('../config/database');

jest.mock('../config/database');

describe('CaseFilestoreService', () => {
  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    pool.connect = jest.fn().mockResolvedValue(mockClient);
  });

  describe('initializeCaseFolders', () => {
    it('should create default folder structure', async () => {
      // Arrange
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // Check existing
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Insert folder

      // Act
      const result = await caseFilestoreService.initializeCaseFolders(123, 1);

      // Assert
      expect(result).toBeInstanceOf(Map);
      expect(mockClient.query).toHaveBeenCalledTimes(2);
    });
  });
});
```

### Integration Test Guidelines

1. **Real Database**: Use test database for integration tests
2. **Clean State**: Reset database state between tests
3. **End-to-End Flows**: Test complete workflows
4. **API Contracts**: Verify API request/response formats

### E2E Test Guidelines

1. **User-Centric**: Write tests from user perspective
2. **Page Object Model**: Use page objects for reusable components
3. **Wait Strategies**: Use proper wait strategies for dynamic content
4. **Test Data**: Use consistent test data across tests
5. **Cleanup**: Clean up test data after each test

### Example E2E Test

```javascript
// tests/e2e/case-management.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Case Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('[data-testid="username"]', 'testuser');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
  });

  test('should create new case', async ({ page }) => {
    // Navigate to cases
    await page.click('[data-testid="nav-cases"]');
    
    // Create new case
    await page.click('[data-testid="create-case-button"]');
    await page.fill('[data-testid="client-name"]', 'John Doe');
    await page.selectOption('[data-testid="case-type"]', 'debt_advice');
    await page.click('[data-testid="submit-case"]');
    
    // Verify case creation
    await expect(page.locator('.success-message')).toContainText('Case created');
  });
});
```

## Coverage Requirements

### Coverage Targets

- **Overall Coverage**: ≥ 70%
- **Critical Paths**: ≥ 90%
- **New Code**: ≥ 80%

### Coverage Types

1. **Line Coverage**: Percentage of executed lines
2. **Branch Coverage**: Percentage of executed branches
3. **Function Coverage**: Percentage of called functions
4. **Statement Coverage**: Percentage of executed statements

### Monitoring Coverage

```bash
# Generate coverage report
npm run test:coverage

# View HTML coverage report
open coverage/lcov-report/index.html
```

### Coverage Exclusions

Certain files are excluded from coverage requirements:
- Configuration files
- Database migration files
- Test files themselves
- Third-party integrations
- Generated files

## CI/CD Integration

### GitHub Actions Workflow

Our CI/CD pipeline runs tests automatically:

```yaml
# .github/workflows/ci-cd.yml
jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run tests
        run: npm run test:server
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

### Test Environments

1. **Local Development**: Full test suite
2. **Pull Request**: Unit + Integration tests
3. **Main Branch**: Full test suite including E2E
4. **Release**: Complete test suite + performance tests

### Quality Gates

Tests must pass before:
- Merging pull requests
- Deploying to staging
- Deploying to production

## Troubleshooting

### Common Issues

#### Test Timeouts
```bash
# Increase timeout for specific test
test('long running operation', async () => {
  // test implementation
}, 30000); // 30 second timeout
```

#### Database Connection Issues
```bash
# Ensure test database is running
docker run -d --name test-postgres \
  -e POSTGRES_USER=testuser \
  -e POSTGRES_PASSWORD=testpass \
  -e POSTGRES_DB=testdb \
  -p 5432:5432 postgres:13
```

#### Mock Issues
```javascript
// Clear mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});

// Reset modules between tests
beforeEach(() => {
  jest.resetModules();
});
```

#### Playwright Issues
```bash
# Install browsers
npx playwright install

# Debug mode
npx playwright test --debug

# Headed mode
npx playwright test --headed
```

### Performance Issues

1. **Parallel Execution**: Run tests in parallel when possible
2. **Test Data**: Use minimal test data sets
3. **Database**: Use in-memory database for unit tests
4. **Mocking**: Mock expensive operations

### Debugging Tests

```bash
# Debug specific test
node --inspect-brk node_modules/.bin/jest server/__tests__/auth.test.js

# Debug Playwright
npx playwright test --debug

# Verbose output
npm test -- --verbose
```

## Best Practices

### General Guidelines

1. **Fast Feedback**: Keep tests fast and reliable
2. **Independent Tests**: Tests should not depend on each other
3. **Clear Assertions**: Use descriptive assertion messages
4. **Test Maintenance**: Keep tests up-to-date with code changes
5. **Documentation**: Document complex test scenarios

### Naming Conventions

```javascript
// Good
describe('UserService', () => {
  describe('createUser', () => {
    it('should create user with valid data', () => {});
    it('should throw error when email already exists', () => {});
  });
});

// Bad
describe('User stuff', () => {
  it('test 1', () => {});
  it('works', () => {});
});
```

### Test Data Management

```javascript
// Use factories for test data
const createTestUser = (overrides = {}) => ({
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  ...overrides
});

// Use meaningful test data
const testUser = createTestUser({
  email: 'specific@example.com'
});
```

### Error Testing

```javascript
// Test error conditions
it('should handle database connection failure', async () => {
  pool.query.mockRejectedValue(new Error('Connection failed'));
  
  await expect(userService.getUser(1))
    .rejects
    .toThrow('Connection failed');
});
```

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Test Coverage Guide](https://martinfowler.com/bliki/TestCoverage.html)