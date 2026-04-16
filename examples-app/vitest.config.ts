import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['(server|job)/**/*.{test,cy}.{ts,js,mjs}'],
    coverage: {
      include: ['server/**/*.{ts,js,mjs}'],
    },
    reporters: ['default', ['junit', { outputFile: 'test_results/junit.xml' }]],
  },
})
