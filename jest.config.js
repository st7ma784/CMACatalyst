module.exports = {
    testEnvironment: 'node',
    roots: ['<rootDir>/server', '<rootDir>/tests'],
    testMatch: [
        '**/__tests__/**/*.js',
        '**/?(*.)+(spec|test).js'
    ],
    collectCoverageFrom: [
        'server/**/*.js',
        '!server/node_modules/**',
        '!server/uploads/**',
        '!server/config/database.js',
        '!server/__tests__/**'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    setupFilesAfterEnv: ['<rootDir>/server/__tests__/setup.js'],
    coverageThreshold: {
        global: {
            branches: 70,
            functions: 70,
            lines: 70,
            statements: 70
        }
    },
    testTimeout: 30000,
    transform: {
        '^.+\\.js$': 'babel-jest'
    },
    transformIgnorePatterns: [
        'node_modules/(?!(uuid|tesseract\\.js)/)'
    ],
    moduleNameMapper: {
        '^uuid$': require.resolve('uuid'),
        '^tesseract\\.js$': '<rootDir>/server/__tests__/__mocks__/tesseract.js'
    }
};
