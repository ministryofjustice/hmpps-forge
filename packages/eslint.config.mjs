import hmppsConfig from '@ministryofjustice/eslint-config-hmpps'
import tsParser from '@typescript-eslint/parser'

export default [
  { ignores: ['**/dist/**'] },
  ...hmppsConfig({
    extraIgnorePaths: ['dist/', '*.config.*'],
  }),
  {
    files: ['**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        sourceType: 'module',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'class-methods-use-this': 'off',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
    },
  },
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
    //   contracts/           — runtime-free sink; depends on nothing in the engine layers
    //   ast/                 — builds the AST; may depend on contracts/ and compile-time support.
    //   semantic-analysis/   — semantic rules on the AST; may depend on ast/ + contracts/ but NOT dependency-analysis/, lowering/, or runtime/.
    //   dependency-analysis/ — derives compile facts; may depend on ast/ + contracts/ but NOT semantic-analysis/, lowering/, or runtime/.
    //   lowering/            — codegen; may depend on ast/ + contracts/ but NOT dependency-analysis/, semantic-analysis/, or runtime/.
    //   runtime/             — execution; may depend only on contracts/
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
                './forge-core/src/engine/compilation/ast',
                './forge-core/src/engine/compilation/semantic-analysis',
                './forge-core/src/engine/compilation/dependency-analysis',
                './forge-core/src/engine/compilation/lowering',
                './forge-core/src/engine/runtime',
              ],
              message: 'contracts/ is a runtime-free sink and must not import from compilation/ or runtime/.',
            },
            {
              target: './forge-core/src/engine/compilation/ast',
              from: [
                './forge-core/src/engine/compilation/semantic-analysis',
                './forge-core/src/engine/compilation/dependency-analysis',
                './forge-core/src/engine/compilation/lowering',
                './forge-core/src/engine/runtime',
              ],
              message:
                'ast/ builds the AST and must not import from semantic-analysis/, dependency-analysis/, lowering/, or runtime/.',
            },
            {
              target: './forge-core/src/engine/compilation/semantic-analysis',
              from: [
                './forge-core/src/engine/compilation/dependency-analysis',
                './forge-core/src/engine/compilation/lowering',
                './forge-core/src/engine/runtime',
              ],
              message:
                'semantic-analysis/ checks the AST and must not import from dependency-analysis/, lowering/, or runtime/.',
            },
            {
              target: './forge-core/src/engine/compilation/dependency-analysis',
              from: [
                './forge-core/src/engine/compilation/semantic-analysis',
                './forge-core/src/engine/compilation/lowering',
                './forge-core/src/engine/runtime',
              ],
              message:
                'dependency-analysis/ derives compile facts and must not import from semantic-analysis/, lowering/, or runtime/.',
            },
            {
              target: './forge-core/src/engine/runtime',
              from: [
                './forge-core/src/engine/compilation/ast',
                './forge-core/src/engine/compilation/semantic-analysis',
                './forge-core/src/engine/compilation/dependency-analysis',
                './forge-core/src/engine/compilation/lowering',
              ],
              message: 'runtime/ executes compiled output and must not import from compilation/.',
            },
            {
              target: './forge-core/src/engine/compilation/lowering',
              from: [
                './forge-core/src/engine/compilation/semantic-analysis',
                './forge-core/src/engine/compilation/dependency-analysis',
                './forge-core/src/engine/runtime',
              ],
              message:
                'lowering/ (codegen) may depend on ast/ + contracts/ but not semantic-analysis/, dependency-analysis/, or runtime/.',
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
    files: ['forge-next-react/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        Console: 'readonly',
        FormData: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
      },
    },
    rules: {
      'class-methods-use-this': 'off',
      'no-restricted-imports': [
        'error',
        {
          paths: ['@ministryofjustice/hmpps-forge/next-react'],
          patterns: [
            '**/forge-core/src',
            '**/forge-core/src/**',
            '**/forge-express-nunjucks/src',
            '**/forge-express-nunjucks/src/**',
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
