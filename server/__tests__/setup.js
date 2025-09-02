// Jest setup file for database tests
const pool = require('../config/database');

// Mock database connection for tests
jest.mock('../config/database', () => ({
    query: jest.fn(),
    connect: jest.fn(() => ({
        query: jest.fn(),
        release: jest.fn()
    }))
}));

// Global test setup
beforeAll(async () => {
    // Setup test database or mock connections
});

afterAll(async () => {
    // Cleanup test database connections
    if (pool && pool.end) {
        await pool.end();
    }
});

// Reset mocks between tests
beforeEach(() => {
    jest.clearAllMocks();
});
