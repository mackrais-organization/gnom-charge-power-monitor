'use strict';

// GJS runtime globals. GNOME Shell runs extensions in GJS, not Node or a
// browser, so these are the host globals that are legitimately available.
const gjsGlobals = {
    ARGV: 'readonly',
    Debugger: 'readonly',
    GIRepositoryGType: 'readonly',
    globalThis: 'readonly',
    imports: 'readonly',
    pkg: 'readonly',
    console: 'readonly',
    log: 'readonly',
    logError: 'readonly',
    print: 'readonly',
    printerr: 'readonly',
    TextEncoder: 'readonly',
    TextDecoder: 'readonly',
    setTimeout: 'readonly',
    setInterval: 'readonly',
    clearTimeout: 'readonly',
    clearInterval: 'readonly',
};

// Deprecated GJS/GNOME modules that the EGO review rejects.
const deprecatedImports = [
    {
        selector: "MemberExpression[object.name='imports'][property.name='byteArray']",
        message: 'imports.byteArray is deprecated; use TextEncoder/TextDecoder.',
    },
    {
        selector: "MemberExpression[object.name='imports'][property.name='lang']",
        message: 'imports.lang is deprecated; use ES6 classes and arrow functions.',
    },
    {
        selector: "MemberExpression[object.name='imports'][property.name='mainloop']",
        message: 'imports.mainloop is deprecated; use GLib timeout/idle sources.',
    },
];

module.exports = [
    {
        files: ['charge-power-monitor@mackrais.gmail.com/**/*.js'],
        linterOptions: {
            reportUnusedDisableDirectives: true,
        },
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
            'no-var': 'error',
            'prefer-const': 'error',
            'eqeqeq': ['error', 'smart'],
            'no-restricted-syntax': ['error', ...deprecatedImports],
        },
    },
];
