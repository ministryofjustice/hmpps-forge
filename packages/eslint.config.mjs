import hmppsConfig from '@ministryofjustice/eslint-config-hmpps'

export default [
  { ignores: ['**/dist/**'] },
  ...hmppsConfig({
    extraIgnorePaths: ['dist/', '*.config.*'],
  }),
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-param-reassign': 'off',
      'prefer-destructuring': 'off',
      'import/prefer-default-export': 'off',
      'import/no-cycle': 'off',
      'no-plusplus': 'off',
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
      },
    },
  },
  {
    files: ['**/test-utils/**/*.ts', '**/test-utils/**/*.js'],
    rules: {
      'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
    },
  },
  {
    files: ['forge-core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: ['@ministryofjustice/hmpps-forge/core', '@ministryofjustice/hmpps-forge/core/*'],
        },
      ],
    },
  },
  {
    files: ['forge-express-nunjucks/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '@ministryofjustice/hmpps-forge/express-nunjucks',
            '@ministryofjustice/hmpps-forge/express-nunjucks/*',
            '**/forge-core/src',
            '**/forge-core/src/**',
            '**/forge-govuk-components/src',
            '**/forge-govuk-components/src/**',
            '**/forge-moj-components/src',
            '**/forge-moj-components/src/**',
          ],
        },
      ],
    },
  },
  {
    files: ['forge-govuk-components/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '@ministryofjustice/hmpps-forge/govuk-components',
            '@ministryofjustice/hmpps-forge/govuk-components/*',
            '**/forge-core/src',
            '**/forge-core/src/**',
            '**/forge-express-nunjucks/src',
            '**/forge-express-nunjucks/src/**',
            '**/forge-moj-components/src',
            '**/forge-moj-components/src/**',
          ],
        },
      ],
    },
  },
  {
    files: ['forge-moj-components/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '@ministryofjustice/hmpps-forge/moj-components',
            '@ministryofjustice/hmpps-forge/moj-components/*',
            '**/forge-core/src',
            '**/forge-core/src/**',
            '**/forge-express-nunjucks/src',
            '**/forge-express-nunjucks/src/**',
            '**/forge-govuk-components/src',
            '**/forge-govuk-components/src/**',
          ],
        },
      ],
    },
  },
  {
    files: ['forge-moj-components/**/*.ts'],
    rules: {
      'no-nested-ternary': 'off',
    },
  },
  {
    files: ['forge-govuk-components/**/*.ts'],
    rules: {
      'no-nested-ternary': 'off',
    },
  },
  {
    name: 'prettier-overrides',
    rules: {
      'prettier/prettier': [
        'warn',
        {
          trailingComma: 'all',
          singleQuote: true,
          printWidth: 120,
          semi: false,
          arrowParens: 'avoid',
          alignObjectProperties: 'none',
          returnParentheses: false,
          plugins: ['@yikes2000/prettier-plugin-merge-extras'],
        },
      ],
    },
  },
]
