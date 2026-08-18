export default [
  {
    // Engine layer boundaries. The compile-time/runtime separation is physical:
    //   contracts/           — runtime-free sink; depends on nothing in the engine layers
    //   ast/                 — builds the AST; may depend on contracts/ and compile-time support.
    //   concerns/semantic-analysis/ — semantic rules on the AST (compile-time-only concern); may depend on ast/ + contracts/ but NOT analysis/, lowering/, or runtime/.
    //   analysis/            — builds the semantic compilation model; may depend on ast/ + contracts/ but NOT semantic-analysis/, lowering/, or runtime/.
    //   lowering/            — code generation; may depend on ast/ + contracts/ but NOT analysis/, semantic-analysis/, or runtime/.
    //   lowering/codegen/    — generated-source IR: fragments, statement nodes, builder, rendering. A leaf inside lowering that imports nothing from the stages or the rest of lowering.
    //   work/                — stage-neutral work substrate (executor, context, task helpers); may depend only on tracing/, contracts/, and errors/
    //   runtime/             — execution; may depend only on contracts/ and work/
    // Tests and testing-helpers are exempt: they wire mocks across layers.
    files: ['forge-core/src/engine/**/*.ts'],
    ignores: ['**/*.test.ts', 'forge-core/src/engine/**/testing-helpers/**'],
    rules: {
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './forge-core/src/engine/chassis/contracts',
              from: [
                './forge-core/src/engine/chassis/compilation/ast',
                './forge-core/src/engine/concerns/semantic-analysis',
                './forge-core/src/engine/chassis/compilation/analysis',
                './forge-core/src/engine/chassis/compilation/lowering',
                './forge-core/src/engine/chassis/runtime',
                './forge-core/src/engine/chassis/work',
              ],
              message: 'contracts/ is a runtime-free sink and must not import from compilation/, runtime/, or work/.',
            },
            {
              target: './forge-core/src/engine/chassis/work',
              from: [
                './forge-core/src/engine/chassis/compilation',
                './forge-core/src/engine/concerns',
                './forge-core/src/engine/chassis/runtime',
              ],
              message:
                'work/ is the stage-neutral work substrate beneath compilation/ and runtime/: it may import only tracing/, contracts/, and errors/.',
            },
            {
              target: './forge-core/src/engine/chassis/compilation/ast',
              from: [
                './forge-core/src/engine/concerns/semantic-analysis',
                './forge-core/src/engine/chassis/compilation/analysis',
                './forge-core/src/engine/chassis/compilation/lowering',
                './forge-core/src/engine/chassis/runtime',
              ],
              message:
                'ast/ builds the AST and must not import from semantic-analysis/, analysis/, lowering/, or runtime/.',
            },
            {
              target: './forge-core/src/engine/concerns/semantic-analysis',
              from: [
                './forge-core/src/engine/chassis/compilation/analysis',
                './forge-core/src/engine/chassis/compilation/lowering',
                './forge-core/src/engine/chassis/runtime',
              ],
              message:
                'concerns/semantic-analysis is a compile-time-only concern: it checks the AST and must not import from analysis/, lowering/, or runtime/.',
            },
            {
              target: './forge-core/src/engine/chassis/compilation/analysis',
              from: [
                './forge-core/src/engine/concerns/semantic-analysis',
                './forge-core/src/engine/chassis/compilation/lowering',
                './forge-core/src/engine/chassis/runtime',
              ],
              message:
                'analysis/ builds the semantic compilation model and must not import from semantic-analysis/, lowering/, or runtime/.',
            },
            {
              target: './forge-core/src/engine/chassis/runtime',
              from: [
                './forge-core/src/engine/chassis/compilation/ast',
                './forge-core/src/engine/concerns/semantic-analysis',
                './forge-core/src/engine/chassis/compilation/analysis',
                './forge-core/src/engine/chassis/compilation/lowering',
              ],
              message: 'runtime/ executes compiled output and must not import from compilation/.',
            },
            {
              target: './forge-core/src/engine/chassis/compilation/lowering',
              from: [
                './forge-core/src/engine/concerns/semantic-analysis',
                './forge-core/src/engine/chassis/compilation/analysis',
                './forge-core/src/engine/chassis/runtime',
              ],
              message: 'lowering/ may depend on ast/ + contracts/ but not semantic-analysis/, analysis/, or runtime/.',
            },
            {
              target: './forge-core/src/engine/chassis/compilation/lowering/codegen',
              from: [
                './forge-core/src/engine/chassis/compilation/ast',
                './forge-core/src/engine/concerns/semantic-analysis',
                './forge-core/src/engine/chassis/compilation/analysis',
                './forge-core/src/engine/chassis/runtime',
              ],
              message:
                'lowering/codegen/ is the generated-source IR and renderer: a leaf module that must not import from the compilation stages or runtime/.',
            },
            {
              target: './forge-core/src/engine/chassis/compilation/lowering/codegen',
              from: './forge-core/src/engine/chassis/compilation/lowering',
              except: ['./codegen'],
              message: 'lowering/codegen/ is Forge-agnostic: it must not import from the rest of lowering/.',
            },
            // Transitional concern-first zones. Files under concerns/<name>/ have left the
            // stage folders above, so they need their own compile-time/runtime separation:
            //   concerns/*/analysis   — compile-time; must not import runtime code
            //   concerns/*/lowering   — compile-time; must not import runtime code
            //   concerns/*/runtime    — execution; must not import compile-time code
            //   concerns/*/contracts  — runtime-free sink
            // `from` cannot mix glob and non-glob entries, so each rule is split into a
            // glob zone (other concerns) and a plain-path zone (the not-yet-moved stages).
            {
              target: [
                './forge-core/src/engine/concerns/*/analysis/**',
                './forge-core/src/engine/concerns/*/lowering/**',
              ],
              from: './forge-core/src/engine/chassis/runtime',
              message: 'concerns/*/analysis and concerns/*/lowering are compile-time and must not import runtime/.',
            },
            {
              target: [
                './forge-core/src/engine/concerns/*/analysis/**',
                './forge-core/src/engine/concerns/*/lowering/**',
              ],
              from: './forge-core/src/engine/concerns/*/runtime/**',
              message:
                'concerns/*/analysis and concerns/*/lowering are compile-time and must not import concerns/*/runtime.',
            },
            {
              target: './forge-core/src/engine/concerns/*/runtime/**',
              from: './forge-core/src/engine/chassis/compilation',
              message: 'concerns/*/runtime executes compiled output and must not import from compilation/.',
            },
            {
              target: './forge-core/src/engine/concerns/*/runtime/**',
              from: [
                './forge-core/src/engine/concerns/*/analysis/**',
                './forge-core/src/engine/concerns/*/lowering/**',
              ],
              message:
                'concerns/*/runtime executes compiled output and must not import concerns/*/analysis or concerns/*/lowering.',
            },
            {
              target: './forge-core/src/engine/chassis/runtime',
              from: [
                './forge-core/src/engine/concerns/*/analysis/**',
                './forge-core/src/engine/concerns/*/lowering/**',
              ],
              message:
                'runtime/ executes compiled output and must not import concerns/*/analysis or concerns/*/lowering.',
            },
            {
              target: './forge-core/src/engine/concerns/*/contracts/**',
              from: ['./forge-core/src/engine/chassis/compilation', './forge-core/src/engine/chassis/runtime'],
              message: 'concerns/*/contracts is a runtime-free sink and must not import from compilation/ or runtime/.',
            },
            {
              target: './forge-core/src/engine/concerns/*/contracts/**',
              from: [
                './forge-core/src/engine/concerns/*/analysis/**',
                './forge-core/src/engine/concerns/*/lowering/**',
                './forge-core/src/engine/concerns/*/runtime/**',
              ],
              message:
                'concerns/*/contracts is a runtime-free sink and must not import concern analysis, lowering, or runtime code.',
            },
            // Concern isolation. A concern owns its whole vertical slice, so by default no
            // concern may import another concern's files. One zone per concern lists every
            // other concern it may NOT import; each zone omits the concerns it is sanctioned
            // to import. The sanctioned edges (importer -> imported) are:
            //   hooks            -> validation       (current-step validation work task + validity result types)
            //   reachability     -> validation       (reachability validity result type)
            //   resolve          -> validation       (validationResult type)
            //   resolve          -> render           (renderBlock brand)
            //   resolve          -> reachability     (backlink + redirect helpers, evaluation type)
            //   answer-cleardown -> reachability     (JourneyReachabilityProjection)
            //   reachability     -> answer-cleardown (StepFieldInventory, type-only)
            //   reachability     -> route            (JourneyRouteTemplateCatalog)
            // dsl-validation (Zod checks on the raw authored shape) has no sanctioned edges
            // in either direction: it sees only authoring types, never other concerns.
            // semantic-analysis (post-AST placement rules) likewise has none: it sees the
            // AST, registries, and contracts, never other concerns.
            {
              target: './forge-core/src/engine/concerns/answer-cleardown/**',
              from: [
                './forge-core/src/engine/concerns/answer-preparation/**',
                './forge-core/src/engine/concerns/dsl-validation/**',
                './forge-core/src/engine/concerns/hooks/**',
                './forge-core/src/engine/concerns/render/**',
                './forge-core/src/engine/concerns/resolve/**',
                './forge-core/src/engine/concerns/route/**',
                './forge-core/src/engine/concerns/semantic-analysis/**',
                './forge-core/src/engine/concerns/validation/**',
              ],
              message:
                'concerns must not import other concerns except sanctioned edges — see the comment above these zones.',
            },
            {
              target: './forge-core/src/engine/concerns/answer-preparation/**',
              from: [
                './forge-core/src/engine/concerns/answer-cleardown/**',
                './forge-core/src/engine/concerns/dsl-validation/**',
                './forge-core/src/engine/concerns/hooks/**',
                './forge-core/src/engine/concerns/reachability/**',
                './forge-core/src/engine/concerns/render/**',
                './forge-core/src/engine/concerns/resolve/**',
                './forge-core/src/engine/concerns/route/**',
                './forge-core/src/engine/concerns/semantic-analysis/**',
                './forge-core/src/engine/concerns/validation/**',
              ],
              message:
                'concerns must not import other concerns except sanctioned edges — see the comment above these zones.',
            },
            {
              target: './forge-core/src/engine/concerns/hooks/**',
              from: [
                './forge-core/src/engine/concerns/answer-cleardown/**',
                './forge-core/src/engine/concerns/answer-preparation/**',
                './forge-core/src/engine/concerns/dsl-validation/**',
                './forge-core/src/engine/concerns/reachability/**',
                './forge-core/src/engine/concerns/render/**',
                './forge-core/src/engine/concerns/resolve/**',
                './forge-core/src/engine/concerns/route/**',
                './forge-core/src/engine/concerns/semantic-analysis/**',
              ],
              message:
                'concerns must not import other concerns except sanctioned edges — see the comment above these zones.',
            },
            {
              target: './forge-core/src/engine/concerns/reachability/**',
              from: [
                './forge-core/src/engine/concerns/answer-preparation/**',
                './forge-core/src/engine/concerns/dsl-validation/**',
                './forge-core/src/engine/concerns/hooks/**',
                './forge-core/src/engine/concerns/render/**',
                './forge-core/src/engine/concerns/resolve/**',
                './forge-core/src/engine/concerns/semantic-analysis/**',
              ],
              message:
                'concerns must not import other concerns except sanctioned edges — see the comment above these zones.',
            },
            {
              target: './forge-core/src/engine/concerns/render/**',
              from: [
                './forge-core/src/engine/concerns/answer-cleardown/**',
                './forge-core/src/engine/concerns/answer-preparation/**',
                './forge-core/src/engine/concerns/dsl-validation/**',
                './forge-core/src/engine/concerns/hooks/**',
                './forge-core/src/engine/concerns/reachability/**',
                './forge-core/src/engine/concerns/resolve/**',
                './forge-core/src/engine/concerns/route/**',
                './forge-core/src/engine/concerns/semantic-analysis/**',
                './forge-core/src/engine/concerns/validation/**',
              ],
              message:
                'concerns must not import other concerns except sanctioned edges — see the comment above these zones.',
            },
            {
              target: './forge-core/src/engine/concerns/resolve/**',
              from: [
                './forge-core/src/engine/concerns/answer-cleardown/**',
                './forge-core/src/engine/concerns/answer-preparation/**',
                './forge-core/src/engine/concerns/dsl-validation/**',
                './forge-core/src/engine/concerns/hooks/**',
                './forge-core/src/engine/concerns/route/**',
                './forge-core/src/engine/concerns/semantic-analysis/**',
              ],
              message:
                'concerns must not import other concerns except sanctioned edges — see the comment above these zones.',
            },
            {
              target: './forge-core/src/engine/concerns/route/**',
              from: [
                './forge-core/src/engine/concerns/answer-cleardown/**',
                './forge-core/src/engine/concerns/answer-preparation/**',
                './forge-core/src/engine/concerns/dsl-validation/**',
                './forge-core/src/engine/concerns/hooks/**',
                './forge-core/src/engine/concerns/reachability/**',
                './forge-core/src/engine/concerns/render/**',
                './forge-core/src/engine/concerns/resolve/**',
                './forge-core/src/engine/concerns/semantic-analysis/**',
                './forge-core/src/engine/concerns/validation/**',
              ],
              message:
                'concerns must not import other concerns except sanctioned edges — see the comment above these zones.',
            },
            {
              target: './forge-core/src/engine/concerns/validation/**',
              from: [
                './forge-core/src/engine/concerns/answer-cleardown/**',
                './forge-core/src/engine/concerns/answer-preparation/**',
                './forge-core/src/engine/concerns/dsl-validation/**',
                './forge-core/src/engine/concerns/hooks/**',
                './forge-core/src/engine/concerns/reachability/**',
                './forge-core/src/engine/concerns/render/**',
                './forge-core/src/engine/concerns/resolve/**',
                './forge-core/src/engine/concerns/route/**',
                './forge-core/src/engine/concerns/semantic-analysis/**',
              ],
              message:
                'concerns must not import other concerns except sanctioned edges — see the comment above these zones.',
            },
            {
              target: './forge-core/src/engine/concerns/dsl-validation/**',
              from: [
                './forge-core/src/engine/concerns/answer-cleardown/**',
                './forge-core/src/engine/concerns/answer-preparation/**',
                './forge-core/src/engine/concerns/hooks/**',
                './forge-core/src/engine/concerns/reachability/**',
                './forge-core/src/engine/concerns/render/**',
                './forge-core/src/engine/concerns/resolve/**',
                './forge-core/src/engine/concerns/route/**',
                './forge-core/src/engine/concerns/semantic-analysis/**',
                './forge-core/src/engine/concerns/validation/**',
              ],
              message:
                'concerns must not import other concerns except sanctioned edges — see the comment above these zones.',
            },
            {
              target: './forge-core/src/engine/concerns/dsl-validation/**',
              from: ['./forge-core/src/engine/chassis/compilation', './forge-core/src/engine/chassis/runtime'],
              message:
                'dsl-validation checks the raw authored shape before the AST exists and must not import from compilation/ or runtime/.',
            },
            {
              target: './forge-core/src/engine/concerns/semantic-analysis/**',
              from: [
                './forge-core/src/engine/concerns/answer-cleardown/**',
                './forge-core/src/engine/concerns/answer-preparation/**',
                './forge-core/src/engine/concerns/dsl-validation/**',
                './forge-core/src/engine/concerns/hooks/**',
                './forge-core/src/engine/concerns/reachability/**',
                './forge-core/src/engine/concerns/render/**',
                './forge-core/src/engine/concerns/resolve/**',
                './forge-core/src/engine/concerns/route/**',
                './forge-core/src/engine/concerns/validation/**',
              ],
              message:
                'concerns must not import other concerns except sanctioned edges — see the comment above these zones.',
            },
          ],
        },
      ],
    },
  },
]
