export default [
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
]
