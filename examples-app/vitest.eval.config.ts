import { defineConfig } from 'vitest/config'

// Dedicated config so the search-quality eval runs only when invoked explicitly
// via `npm run search:eval`. The default vitest.config.ts include glob excludes
// `*.eval.ts`, keeping this out of `npm test` / CI.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['server/data/guideSearch.eval.ts'],
    // The eval prints its report with console.log; let it reach stdout unbuffered.
    disableConsoleIntercept: true,
  },
})
