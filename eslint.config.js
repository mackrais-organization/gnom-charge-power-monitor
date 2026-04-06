const gjsGlobals = {
    console: 'readonly',
    imports: 'readonly',
    TextDecoder: 'readonly',
};

module.exports = [
    {
        files: ['charge-power-monitor@mackrais.gmail.com/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: gjsGlobals,
        },
        rules: {
            'no-unused-vars': ['error', {
                args: 'none',
                caughtErrors: 'none',
            }],
            'no-undef': 'error',
            'no-redeclare': 'error',
            'prefer-const': 'error',
        },
    },
];
