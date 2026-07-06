export default [
  {
    // The devtools panel is bundled at build time, so preact never ships as a runtime dependency
    files: ['forge-devtools/src/plugin/**/*.ts'],
    rules: {
      'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
    },
  },
]
