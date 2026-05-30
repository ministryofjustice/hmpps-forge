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
      'no-await-in-loop': 'off',
      'no-continue': 'off',
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
    files: ['**/testing-helpers/**/*.ts', 'forge-express-nunjucks/src/adapter/types.ts'],
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
    // Engine layer boundaries. The compile-time/runtime separation is physical:
    //   contracts/  — runtime-free sink; depends on nothing in the engine layers
    //   ast/        — builds the AST; may depend only on contracts/
    //   lowering/   — codegen; may depend on ast/ + contracts/ but NOT runtime/.
    //   runtime/    — execution; may depend only on contracts/
    // Tests and testing-helpers are exempt: they wire mocks across layers.
    files: ['forge-core/src/engine/**/*.ts'],
    ignores: ['**/*.test.ts', 'forge-core/src/engine/**/testing-helpers/**'],
    rules: {
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './forge-core/src/engine/contracts',
              from: [
                './forge-core/src/engine/ast',
                './forge-core/src/engine/lowering',
                './forge-core/src/engine/runtime',
              ],
              message: 'contracts/ is a runtime-free sink and must not import from ast/, lowering/, or runtime/.',
            },
            {
              target: './forge-core/src/engine/ast',
              from: ['./forge-core/src/engine/lowering', './forge-core/src/engine/runtime'],
              message: 'ast/ builds the AST and may depend only on contracts/, not lowering/ or runtime/.',
            },
            {
              target: './forge-core/src/engine/runtime',
              from: ['./forge-core/src/engine/ast', './forge-core/src/engine/lowering'],
              message: 'runtime/ executes compiled output and may depend only on contracts/, not ast/ or lowering/.',
            },
            {
              target: './forge-core/src/engine/lowering',
              from: ['./forge-core/src/engine/runtime'],
              message:
                'lowering/ (codegen) may depend on ast/ + contracts/ but not runtime/.',
            },
          ],
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
