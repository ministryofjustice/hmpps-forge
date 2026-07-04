import { configDefaults, defineConfig } from 'vitest/config'

import baseConfig from './vitest.config'

// Integration tests need examples-app's dependencies installed (they import its
// guide sources), so they run through this config via `npm run test:integration`
// instead of the plain test run.
export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ['**/*.integration.test.ts'],
    exclude: [...configDefaults.exclude],
  },
})
