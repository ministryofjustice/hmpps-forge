import { resolve } from 'node:path'

import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@ministryofjustice\/hmpps-forge\/core\/authoring$/,
        replacement: resolve(import.meta.dirname, './forge-core/src/authoring/index.ts'),
      },
      {
        find: /^@ministryofjustice\/hmpps-forge\/core\/components$/,
        replacement: resolve(import.meta.dirname, './forge-core/src/components/index.ts'),
      },
      {
        find: /^@ministryofjustice\/hmpps-forge\/core\/framework$/,
        replacement: resolve(import.meta.dirname, './forge-core/src/framework/index.ts'),
      },
      {
        find: /^@ministryofjustice\/hmpps-forge\/core$/,
        replacement: resolve(import.meta.dirname, './forge-core/src/index.ts'),
      },
      {
        find: /^@ministryofjustice\/hmpps-forge\/express-nunjucks$/,
        replacement: resolve(import.meta.dirname, './forge-express-nunjucks/src/index.ts'),
      },
      {
        find: /^@ministryofjustice\/hmpps-forge\/govuk-components$/,
        replacement: resolve(import.meta.dirname, './forge-govuk-components/src/index.ts'),
      },
      {
        find: /^@ministryofjustice\/hmpps-forge\/moj-components$/,
        replacement: resolve(import.meta.dirname, './forge-moj-components/src/index.ts'),
      },
    ],
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/__tests__/**/*.{ts,tsx}', '**/?(*.)+(spec|test).{ts,tsx}'],
    // Integration tests reach into examples-app, whose dependencies are not
    // installed for the plain packages test run - `npm run test:integration` runs them.
    exclude: [...configDefaults.exclude, '**/*.integration.test.ts'],
    coverage: {
      provider: 'v8',
      thresholds: {
        branches: 90,
        functions: 90,
        lines: 90,
        statements: 90,
      },
      exclude: ['**/test/**', '**/test-utils/**'],
    },
  },
})
