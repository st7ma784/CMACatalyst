module.exports = {
    testEnvironment: 'node',
    roots: ['<rootDir>/server'],
    testMatch: [
        '**/__tests__/**/*.js',
        '**/?(*.)+(spec|test).js'
    ],
    collectCoverageFrom: [
        'server/**/*.js',
        '!server/node_modules/**',
        '!server/uploads/**',
        '!server/config/database.js'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    setupFilesAfterEnv: ['<rootDir>/server/__tests__/setup.js']
};
