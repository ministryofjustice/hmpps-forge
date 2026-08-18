import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import boundaries from '@boundaries/eslint-plugin'
import sonarjs from 'eslint-plugin-sonarjs'
import vitest from 'eslint-plugin-vitest'
import tseslint from 'typescript-eslint'

const tsconfigRootDir = dirname(fileURLToPath(import.meta.url))

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/*.config.*', 'node_modules/**'],
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
  },
  {
    name: 'readability/typescript',
    files: ['**/*.ts'],
    ignores: ['**/*.test.ts', '**/test-utils/**/*.ts', '**/testing-helpers/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      boundaries,
      sonarjs,
    },
    settings: {
      'boundaries/root-path': tsconfigRootDir,
      'boundaries/elements': [
        { type: 'engine-contracts', pattern: 'forge-core/src/engine/chassis/contracts/**' },
        { type: 'engine-ast', pattern: 'forge-core/src/engine/chassis/compilation/ast/**' },
        { type: 'engine-analysis', pattern: 'forge-core/src/engine/chassis/compilation/analysis/**' },
        { type: 'engine-lowering', pattern: 'forge-core/src/engine/chassis/compilation/lowering/**' },
        { type: 'engine-runtime', pattern: 'forge-core/src/engine/chassis/runtime/**' },
      ],
    },
    rules: {
      complexity: ['warn', { max: 5 }],
      'max-depth': ['warn', { max: 3 }],
      'max-lines-per-function': ['warn', { max: 20, skipBlankLines: true, skipComments: true }],
      'max-params': ['warn', 3],
      'max-statements': ['warn', 10],

      '@typescript-eslint/await-thenable': 'warn',
      '@typescript-eslint/no-confusing-void-expression': [
        'warn',
        { ignoreArrowShorthand: true, ignoreVoidOperator: true },
      ],
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-misused-promises': ['warn', { checksVoidReturn: false }],
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
      '@typescript-eslint/switch-exhaustiveness-check': 'warn',

      'sonarjs/cognitive-complexity': ['warn', 3],
      'sonarjs/expression-complexity': ['warn', { max: 7 }],
      'sonarjs/nested-control-flow': ['warn', { maximumNestingLevel: 3 }],
      'sonarjs/no-all-duplicated-branches': 'warn',
      'sonarjs/no-collapsible-if': 'warn',
      'sonarjs/no-duplicated-branches': 'warn',
      'sonarjs/no-identical-conditions': 'warn',
      'sonarjs/no-identical-functions': ['warn', 5],
      'sonarjs/no-nested-conditional': 'warn',
      'sonarjs/no-nested-functions': ['warn', { threshold: 3 }],
      'sonarjs/no-redundant-boolean': 'warn',
      'sonarjs/prefer-immediate-return': 'warn',
      'sonarjs/prefer-single-boolean-return': 'warn',

      'boundaries/dependencies': [
        'warn',
        {
          default: 'allow',
          rules: [
            {
              from: { type: 'engine-contracts' },
              disallow: {
                to: { type: ['engine-ast', 'engine-analysis', 'engine-lowering', 'engine-runtime'] },
              },
            },
            {
              from: { type: 'engine-ast' },
              disallow: {
                to: { type: ['engine-analysis', 'engine-lowering', 'engine-runtime'] },
              },
            },
            {
              from: { type: 'engine-analysis' },
              disallow: {
                to: { type: ['engine-lowering', 'engine-runtime'] },
              },
            },
            {
              from: { type: 'engine-lowering' },
              disallow: {
                to: { type: ['engine-analysis', 'engine-runtime'] },
              },
            },
            {
              from: { type: 'engine-runtime' },
              disallow: {
                to: { type: ['engine-ast', 'engine-analysis', 'engine-lowering'] },
              },
            },
          ],
        },
      ],
    },
  },
  {
    name: 'readability/vitest',
    files: ['**/*.test.ts'],
    plugins: {
      vitest,
    },
    rules: {
      'vitest/expect-expect': 'warn',
      'vitest/max-nested-describe': ['warn', { max: 2 }],
      'vitest/no-commented-out-tests': 'warn',
      'vitest/no-conditional-expect': 'warn',
      'vitest/no-conditional-tests': 'warn',
      'vitest/no-disabled-tests': 'warn',
      'vitest/no-done-callback': 'warn',
      'vitest/no-duplicate-hooks': 'warn',
      'vitest/no-focused-tests': 'warn',
      'vitest/no-identical-title': 'warn',
      'vitest/no-import-node-test': 'warn',
      'vitest/valid-expect': 'warn',
      'vitest/valid-title': 'warn',
    },
  },
  {
    name: 'readability/test-type-signals',
    files: ['**/*.test.ts', '**/test-utils/**/*.ts', '**/testing-helpers/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-misused-promises': ['warn', { checksVoidReturn: false }],
    },
  },
)
