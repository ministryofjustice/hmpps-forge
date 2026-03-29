import hmppsConfig from '@ministryofjustice/eslint-config-hmpps'

export default [
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
    files: ['form-engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: ['hmpps-forge/core', 'hmpps-forge/core/*'],
        },
      ],
    },
  },
  {
    files: ['form-engine-express-nunjucks/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            'hmpps-forge/express-nunjucks',
            'hmpps-forge/express-nunjucks/*',
            '**/form-engine/src',
            '**/form-engine/src/**',
            '**/form-engine-govuk-components/src',
            '**/form-engine-govuk-components/src/**',
            '**/form-engine-moj-components/src',
            '**/form-engine-moj-components/src/**',
          ],
        },
      ],
    },
  },
  {
    files: ['form-engine-govuk-components/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            'hmpps-forge/govuk-components',
            'hmpps-forge/govuk-components/*',
            '**/form-engine/src',
            '**/form-engine/src/**',
            '**/form-engine-express-nunjucks/src',
            '**/form-engine-express-nunjucks/src/**',
            '**/form-engine-moj-components/src',
            '**/form-engine-moj-components/src/**',
          ],
        },
      ],
    },
  },
  {
    files: ['form-engine-moj-components/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            'hmpps-forge/moj-components',
            'hmpps-forge/moj-components/*',
            '**/form-engine/src',
            '**/form-engine/src/**',
            '**/form-engine-express-nunjucks/src',
            '**/form-engine-express-nunjucks/src/**',
            '**/form-engine-govuk-components/src',
            '**/form-engine-govuk-components/src/**',
          ],
        },
      ],
    },
  },
  {
    files: ['form-engine-moj-components/**/*.ts'],
    rules: {
      'no-nested-ternary': 'off',
    },
  },
  {
    files: ['form-engine-govuk-components/**/*.ts'],
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
