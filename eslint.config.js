module.exports = {
    languageOptions: {
        globals: {
            node: true
        },
        parserOptions: {
            project: './tsconfig.json'
        }
    },
    ignores: ['typedoc.js', '**/docs/**', '**/node_modules/**', '**/dist/**', '**/build/**', '**/lib/**'],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/eslint-recommended',
        'plugin:@typescript-eslint/recommended',
        'prettier'
    ],
    root: true,
    rules: {
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-empty-interface': 'off'
    }
}
