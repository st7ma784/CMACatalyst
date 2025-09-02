module.exports = {
    env: {
        browser: true,
        commonjs: true,
        es2021: true,
        node: true,
        jest: true
    },
    extends: [
        'eslint:recommended'
    ],
    parserOptions: {
        ecmaVersion: 12,
        sourceType: 'module'
    },
    rules: {
        'indent': ['error', 4],
        'linebreak-style': ['error', 'unix'],
        'quotes': ['error', 'single'],
        'semi': ['error', 'always'],
        'no-unused-vars': ['warn'],
        'no-console': 'off',
        'no-undef': 'error'
    },
    globals: {
        'process': 'readonly',
        'Buffer': 'readonly',
        '__dirname': 'readonly',
        'module': 'readonly',
        'require': 'readonly',
        'exports': 'readonly'
    }
};
