export default [
  {
    files: ['forge-express-nunjucks/src/adapter/types.ts'],
    rules: {
      'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
    },
  },
]
