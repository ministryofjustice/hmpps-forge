import { resolve } from 'node:path'

import { defineConfig } from 'vitest/config'

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
      {
        find: /^@ministryofjustice\/hmpps-forge\/next-react\/client$/,
        replacement: resolve(import.meta.dirname, './forge-next-react/src/client.tsx'),
      },
      {
        find: /^@ministryofjustice\/hmpps-forge\/next-react$/,
        replacement: resolve(import.meta.dirname, './forge-next-react/src/index.ts'),
      },
    ],
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/__tests__/**/*.{ts,tsx}', '**/?(*.)+(spec|test).{ts,tsx}'],
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
