// Jest setup file for database tests
// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';

// Mock console.error and console.log for cleaner test output
global.console = {
    ...console,
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
};

// Mock the database pool
const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
};

const mockPool = {
    query: jest.fn(),
    connect: jest.fn(() => mockClient),
    end: jest.fn(),
};

// Mock database module
jest.mock('../config/database', () => mockPool);

// Global test setup
beforeAll(async () => {
    // Setup test database or mock connections
});

afterAll(async () => {
    // Cleanup test database connections
    jest.clearAllMocks();
});

// Reset mocks between tests
beforeEach(() => {
    jest.clearAllMocks();
    mockClient.query.mockClear();
    mockClient.release.mockClear();
    mockPool.query.mockClear();
    mockPool.connect.mockClear();
});

// Export mocks for use in tests
global.mockClient = mockClient;
global.mockPool = mockPool;
