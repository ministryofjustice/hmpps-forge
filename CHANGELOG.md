# Changelog

<!--
## X.Y.Z

One or two sentences on what this release is about.

---

### For journey authors
*Definitions, expressions, hooks, navigation, reachability*

#### Breaking changes
#### New
#### Improvements
#### Fixes
#### Notes

---

### For function and component authors
*Conditions, transformers, effects, generators, iterators, component packages*

#### Breaking changes
#### New
#### Improvements
#### Fixes
#### Notes

---

### For adapter and renderer developers
*Express adapter, Nunjucks renderer, test harness, framework integration*

#### Breaking changes
#### New
#### Deprecated
#### Improvements
#### Fixes
#### Notes

---

### For engine / internal developers
*Compilation, runtime, contracts, diagnostics, instrumentation*

#### Changes
#### Fixes
#### Notes

Delete empty sections. Use "No changes in this release." for sections with nothing.
-->

---

## 0.4.0

A tidy-up of the authoring surface - the GOV.UK utility wrappers are real components
now, `createForgePackage()` is mandatory and stamps provenance on every node so errors
point at the line in your code that defined the offending definition, and everything
the engine throws is one exported family of `Forge*` error classes.

### Added

- The `Forge*` error classes are exported from core - catch and narrow with
  `instanceof`, and a single `instanceof ForgeBaseError` check answers "did Forge
  throw this" ([#229])
- `ForgeAuthoringError` for authoring API misuse caught while builders are still
  assembling the definition, and `ForgeInternalError` for states the engine should
  make impossible - seeing one is a bug in Forge ([#229])
- `Defined at:` lines on every author-facing error, pointing at the builder call that
  defined the offending node ([#209], [#210])
- List items can be blocks - `GovUKList` items may mix strings with child blocks, and
  each block renders inside its own `<li>` ([#203])
- `Format()` takes a resolvable template - a reference or any string-valued expression
  works: `Format(Answer('template'), ...)` ([#210])

### Changed

- The GOV.UK utility wrappers are real registered components written in the
  experimental JSX API - `GovUKList`'s `type` prop is now `style`, and the standalone
  `GovUK*Props` interfaces are gone ([#203])
- `createForgePackage()` is mandatory - registration rejects anything that hasn't
  passed through it, and `journey` also accepts a JSON string ([#209])
- The engine's errors follow one `Forge`-prefixed naming scheme on a shared
  `ForgeBaseError` base class ([#229])
- `core/framework` is types-only - the path utilities are no longer exported, so copy
  the ones you used into your adapter; they're a few lines each ([#212])

### Removed

- The field-level `multiple` flag - it overlapped with the flag that array-shaped
  components like checkboxes already declare on their registry entry, so keeping every
  posted value is solely the component's decision now. Setting `multiple` on a field
  block is a type error; just remove it ([#206])
- The expression builder classes and the granular condition variant types from the
  authoring exports - the factories (`Conditional()`, `Match()`, ...) were always the
  intended surface, and `ConditionalExpr` covers the variant types.
  `PredicateTestExprBuilder` is deleted outright; it was dead code ([#208])
- Error codes and the error `toString()` implementations - the class is the
  discriminator now ([#229])

### Fixed

- Sharing a partially built `Conditional()`/`Match()` chain no longer
  cross-contaminates - each chain step returns a fresh builder ([#208])
- Builders are detected by a `nodeKind` marker instead of `'build' in value`
  duck-typing, so an authored object that happens to have a `build` property can't be
  mistaken for a builder and swallowed during finalisation ([#209])
- The two validation rules missing the `formattedPath` fallback now default it to
  `unknown` like the rest ([#210])
- The deprecated `defineFunction` helpers never stamped callsites on the handles they
  build, so their errors lacked a `Defined at` line - they stamp now ([#210])

### Details

#### GOV.UK wrappers as real components

Previously `GovUKBody`, `GovUKHeading`, `GovUKList`, `GovUKGridRow`,
`GovUKSectionBreak` and `GovUKButtonGroup` were authoring functions that expanded into
generic `html`/`template` blocks. They now register and render like every other
component, with their renders written in the experimental JSX API. Builder names and
props are unchanged, with one exception: `GovUKList`'s `type` prop is now `style`
(`type` is the engine's structure discriminator on real components). The standalone
`GovUK*Props` interfaces are gone - each component's single interface (`GovUKBody`,
`GovUKList`, ...) is both the props and the block type. If you register
`govukComponents` wholesale nothing else changes; if you cherry-pick registry entries,
add the six new ones. ([#203])

#### Mandatory `createForgePackage()` and callsite attribution

Previously `createForgePackage()` was a typing convenience - `registerPackage()` took
anything with the right properties - and errors could only name the DSL path, leaving
you to hunt the definition down yourself. Now registration rejects anything that
hasn't passed through `createForgePackage()`, which finalises the builders in the
journey tree and stamps every node with its source location and the callsite that
defined it. Every author-facing error - registration validation, schema and
serialisation failures, runtime evaluation errors - then carries a
`Defined at: journeySteps (/app/journeys/tax/steps.ts:42:13)` line pointing at the
builder call that defined the offending node. The frame picked is the first one
outside forge-core, node internals and `node_modules`, so when a component from a
published package produces an error, it points at your usage site rather than inside
the package. If you already wrap your package, nothing changes; if not, it's
`registerPackage(createForgePackage({ journey, ... }))`. ([#209], [#210])

#### One family of Forge errors

Previously the engine threw a mixture of plain `Error`s and per-concern classes - some
`Forge`-prefixed, some not, each carrying a string `code` and its own `toString()`,
and none of them exported. Now there's one family: every class extends
`ForgeBaseError`, the names all follow the `Forge*` scheme, and the whole set is
exported from core so you can catch and narrow with `instanceof`. The codes and
`toString()` implementations are binned - the class is the discriminator. Two classes
are new: `ForgeAuthoringError` for authoring API misuse caught while the builders are
still assembling the definition, and `ForgeInternalError` for states the engine should
make impossible. ([#229])

#### Under the hood

- The authoring builders are reorganised into domain files (structures, values,
  references, expressions) with a curated export list, and `Format` is a
  registry-backed generator now with the hand-rolled `FormatString` implementation
  inlined away ([#208])
- Finalisation stamps every object node with non-enumerable `__source` and
  `__callsite` provenance - the callsite capture is lazy (V8's `.stack` accessor), so
  there's no formatting cost unless an error actually reads it - and hook helpers are
  plain taggers now, with finalisation doing the walking they used to do themselves
  ([#209])
- Runtime diagnostics carry a preformatted `definedAt` baked into the generated source
  metadata at emit time - `formatCallsite` in shared diagnostics does the
  frame-picking, and display stays lazy everywhere else ([#210])
- The built-in conditions, transformers, generators and core components live together
  under `forge-core/src/built-ins/{functions,components}` - the authoring and
  components barrels re-export them, so the published subpaths are unchanged. The
  registries' `registerBuiltIn*` methods are gone too: `Forge`'s constructor registers
  the built-ins through the ordinary `register()`/`registerMany()` path, leaving the
  registry classes content-agnostic ([#211])
- `routePath.ts` lives in `shared/utils` now, trimmed to the four functions the engine
  uses - `resolveMountedPath` had no callers at all and is deleted. The express
  adapter and the test client each carry their own `extractPathname`: turning a raw
  URL into snapshot terms is the adapter role's job, whichever side plays it ([#212])
- The framework types are one folder now - `rendering/types.ts` became
  `types/rendering.type.ts` to match its siblings, with the route tree types split out
  into `types/routeTree.type.ts`. Public exports are unchanged ([#212])
- `NodeFactory` is table-driven dispatch now - a creator table with one row per node
  type, and `ForgeUnknownNodeTypeError` for a type the table has no row for ([#219])
- Raw `Error` throws across the engine and authoring internals moved onto the Forge
  error classes ([#229])
- A tidy-up of the export surface - a bunch of symbols only used inside their own
  file are no longer exported, dead typeguards and type aliases are deleted, and four
  unused devDependencies are gone. The contract tests' `test/` folder is typechecked
  now too, which caught stale imports from the `framework/types` move and a
  declared-but-never-implemented effect in the hooks fixtures ([#230])
- The engine is concern-first now - each concern (hooks, validation, reachability,
  ...) owns its whole slice under `engine/concerns/<name>/{analysis,lowering,runtime,contracts}`
  instead of spreading across the compilation and runtime stage folders, with eslint
  import zones enforcing the boundaries. Public exports are unchanged ([#236])

[#203]: https://github.com/ministryofjustice/hmpps-forge/pull/203
[#206]: https://github.com/ministryofjustice/hmpps-forge/pull/206
[#208]: https://github.com/ministryofjustice/hmpps-forge/pull/208
[#209]: https://github.com/ministryofjustice/hmpps-forge/pull/209
[#210]: https://github.com/ministryofjustice/hmpps-forge/pull/210
[#211]: https://github.com/ministryofjustice/hmpps-forge/pull/211
[#212]: https://github.com/ministryofjustice/hmpps-forge/pull/212
[#219]: https://github.com/ministryofjustice/hmpps-forge/pull/219
[#229]: https://github.com/ministryofjustice/hmpps-forge/pull/229
[#230]: https://github.com/ministryofjustice/hmpps-forge/pull/230
[#236]: https://github.com/ministryofjustice/hmpps-forge/pull/236

---

## 0.3.6

A typing-focused release - registered function handles now know what their arguments
are, built-ins validate their inputs through schemas instead of hand-rolled asserts,
and registering a function now reads the same as registering a component.

### Added

- `Resolvable<T>` and `ResolvableExpression<T>` types - handles are typed from their
  evaluator's annotations, and every argument still accepts an expression ([#213])
- `argumentsSchema` and `inputSchema` on the built-in conditions and transformers -
  bad arguments now surface through the engine's normal precheck diagnostics ([#222])
- `factory` embedded in registration options - `register(name, { argumentsSchema,
  factory })` on all four authoring registries, matching `component(variant, options)`
  ([#223])

### Changed

- Built-in evaluators declare plain argument types - the handle wraps them in
  `Resolvable<T>` itself, and the schema-backed ones drop their casts ([#221])

### Fixed

- Export types - bumped rolldown to fix misaligned JSDoc, and reworked the DTS bundle
  so IntelliJ shows JSDoc on function-typed props ([#220])

### Details

#### Typed handle arguments

Previously a function whose evaluator annotated its parameters - `(value: string,
min: number) => ...` - produced a handle that rejected expressions outright:
`HasMinLength(Answer('minimumLength'))` was a type error. Now `register()` returns a
handle typed `(min: Resolvable<number>)`: literals are checked against the declared
type (`HasMinLength('5')` is rejected), and references, pipelines, iterations, and
generator chains are accepted through the `ResolvableExpression` marker. Both types
are exported for use in your own signatures, and unannotated evaluators behave
exactly as before. ([#213], [#221])

#### Schema validation for built-ins

Previously the built-in conditions and transformers guarded their inputs with ad-hoc
asserts inside the evaluators, each reporting failures its own way. They now declare
`argumentsSchema` and `inputSchema`, so wrong arguments and inputs come back through
the same precheck diagnostics as user-registered functions - and since the schemas
guarantee the runtime types, the evaluators lose their casts too. ([#221], [#222])

#### `factory` in registration options

Registering a function read differently to registering a component - components take
one options object with everything in it, functions took a positional factory after
the options. All four authoring registries now accept `register(name, { factory: ...
})` with the schemas alongside, and the internals all use this form. The positional
forms still work exactly as before. ([#223])

[#213]: https://github.com/ministryofjustice/hmpps-forge/pull/213
[#220]: https://github.com/ministryofjustice/hmpps-forge/pull/220
[#221]: https://github.com/ministryofjustice/hmpps-forge/pull/221
[#222]: https://github.com/ministryofjustice/hmpps-forge/pull/222
[#223]: https://github.com/ministryofjustice/hmpps-forge/pull/223

---

## 0.3.5

This release we focused on improving the experience for building components - defining
one is now a single `component()` declaration, and there's an experimental JSX runtime
for writing renders in real markup. There's also a new `Fragment` core component for
grouping blocks without adding a wrapper element.

### For journey authors

_Definitions, expressions, hooks, navigation, reachability_

#### New

- **Fragment component.** Groups child blocks without adding a wrapper element - the
  blocks render back-to-back exactly as they would as siblings. Previously anywhere
  expecting a single block (most commonly the template of an `Iterator.Map()`) meant
  wrapping multiple components in an `HtmlBlock` and taking an extra `<div>` with it.
  Now `Fragment({ blocks: [...] })` outputs them all with nothing extra, and
  `visibleWhen` on the fragment shows or hides the whole group. ([#204])

---

### For function and component authors

_Conditions, transformers, effects, generators, iterators, component packages_

#### New

- **Single-declaration components.** `component()` - and `nunjucksComponent()`, its
  Express/Nunjucks form - defines a component from one block interface: the returned value
  is both the builder authors call with props and the registry entry the framework renders
  with. Previously a component was four declarations kept in agreement by hand - a props
  interface, a block interface, a wrapper function and a `buildNunjucksComponent`
  registration. Field components declare `field: true` and can attach an `inputSchema`,
  and a `prepare` hook adjusts authored props before the block is built - a date input
  prepending its ISO formatters, for instance. `nunjucksComponent()` pins the renderer
  type, so render callbacks get a typed `nunjucks.Environment` with no casting.
  `buildNunjucksComponent` still works, and its docs now point at the replacement.
  ([#199], [#200])

- **JSX components (experimental).** `jsxComponent()` in the new
  `@ministryofjustice/hmpps-forge/jsx-components` package defines a component whose render
  is written in JSX - compiled to plain escaped HTML strings by the package's own runtime,
  no React or other framework underneath. Point TypeScript at it (`"jsx": "react-jsx"`,
  `"jsxImportSource": "@ministryofjustice/hmpps-forge/jsx-components"`) and render
  callbacks write real markup with typed HTML attributes (`class`, `for`) instead of
  template strings. Dynamic values are escaped by default; `raw()` marks already-rendered
  HTML - a child block's output, say - as safe to embed. The whole package is
  experimental: it may change or be removed in a minor release. ([#201])

#### Improvements

- **All-optional builders can be called bare.** A `component()` builder whose props are
  all optional no longer needs an empty object - an all-defaults block is just
  `MyDivider()`. Builders with any required prop still require the argument. ([#202])

[#199]: https://github.com/ministryofjustice/hmpps-forge/pull/199
[#200]: https://github.com/ministryofjustice/hmpps-forge/pull/200
[#201]: https://github.com/ministryofjustice/hmpps-forge/pull/201
[#202]: https://github.com/ministryofjustice/hmpps-forge/pull/202
[#204]: https://github.com/ministryofjustice/hmpps-forge/pull/204

---

## 0.3.4

### For journey authors

_Definitions, expressions, hooks, navigation, reachability_

#### New

- **Page templates can see block data.** Previously the `blocks` array in the page template
  context was just rendered HTML strings - the block's variant, properties, and metadata were
  gone by the time the template ran. The Nunjucks renderer (and `createExpressRouter`) now
  takes `includeBlockData: boolean`. It defaults to false, keeping the plain strings; true
  hands templates `{ html, block }` pairs instead, so a template can group, filter, or
  inspect blocks - e.g. splitting a page into regions with `selectattr` over
  `block.properties.metadata`. Blocks that rendered nothing stay in the array with an empty
  `html`, so it always lines up with the step's authored blocks. ([#193])

- **Combinators in `match()` branches.** Previously `.branch()` only took a single
  condition, so testing two things at once - "is an object *and* has an `eventUuid`" -
  meant falling back to nested `when()` chains. `and`, `or`, `xor`, and `not` now accept
  bare conditions as well as predicates: `branch(and(Condition.Object.IsObject(),
  Condition.Object.PropertyHasValue('eventUuid')), ...)`. There's no `.match()` call
  because the branch has no subject of its own - every condition in the tree is tested
  against the match subject, and combinators nest to any depth. Mixing bare conditions
  with predicates in one call is a type error. ([#194])

#### Improvements

- **JSDoc across the authoring types.** Previously most fields on `JourneyDefinition` and
  `StepDefinition` had no docs at all, and a bunch of the existing ones had drifted -
  examples used enum values and function names that don't exist, and the `SubmitHook` docs
  claimed `onValid`/`onInvalid` only run when `validate` is true (they route on the step's
  recorded validity). Every field is now documented, with each claim verified against the
  engine, and examples use real registered function names. ([#191])

---

### For engine / internal developers

_Compilation, runtime, contracts, diagnostics, instrumentation_

#### Notes

- **`http-errors` is no longer a dependency.** It was used in one place - stamping
  `status`, `statusCode` and `expose` onto the error the Express adapter passes to
  `next` - so the adapter now sets the three properties itself. ([#195])

[#191]: https://github.com/ministryofjustice/hmpps-forge/pull/191
[#193]: https://github.com/ministryofjustice/hmpps-forge/pull/193
[#194]: https://github.com/ministryofjustice/hmpps-forge/pull/194
[#195]: https://github.com/ministryofjustice/hmpps-forge/pull/195

---

## 0.3.3

In this release, we focused on testing - one-line outcome assertions for journey tests,
and registered functions can now be unit tested through the engine's real evaluation
pipeline instead of calling the raw evaluator and skipping it. We also made some
small improvements to the typings!

### For journey authors

_Definitions, expressions, hooks, navigation, reachability_

#### New

- **Outcome assertion helpers for the test harness.** `core/testing` now exports
  `expectRenderOutcome`, `expectRedirectOutcome` and `expectErrorOutcome`. Previously
  asserting on a `TestResult` took two steps - `expect(result.type).toBe('render')` to
  fail the test, then `if (result.type === 'render')` anyway because matchers don't
  narrow the union. Each helper does both in one statement: it throws
  `ForgeTestOutcomeAssertionError` when the outcome differs, with a message saying what
  actually happened (the redirect URL, the error status and message, or the rendered
  step's title), and its `asserts` signature narrows `result` for the rest of the
  test. ([#180])

#### Improvements

- **Boolean conditions accept any dynamic expression.** `resumeWhen`, `entryWhen`,
  entry validation `when` and block `visibleWhen` were limited to `true` or a predicate
  expression, even though the engine could already evaluate anything - only the types
  and schemas were in the way. All four now take a `ResolvableBoolean`: a boolean
  literal, a predicate, or any dynamic expression (a reference, conditional, pipeline
  and so on), coerced to a boolean at evaluation. `false` is also now valid and behaves
  the same as omitting the condition. ([#175])

#### Notes

- **`getErrorSummaryList` is now exported from `govuk-components`.** The
  `toErrorList` Nunjucks global that converts Forge validation errors into
  `govukErrorSummary`'s `{ text, href }` shape was previously something every app
  had to write inline. It now ships as `registerForgeGovUKComponentsGlobals(nunjucksEnv)`,
  which registers `getErrorSummaryList` - a global that reads the errors from the
  template context automatically, so templates just call `getErrorSummaryList()` with
  no arguments. ([#176])

---

### For function and component authors

_Conditions, transformers, effects, generators, iterators, component packages_

#### New

- **Test registered functions through the real evaluation pipeline.** Previously the
  only way to unit test a registered function was to call the raw evaluator off
  `registry.build()` - which skips everything the engine wraps around the call at
  runtime: `argumentsSchema`/`inputSchema` prechecks, the undefined short-circuit and
  output validation, so a wrong schema shipped silently. `FunctionRegistryTestHarness`
  (from `core/testing`) takes a registry (or an array of them) plus deps, and evaluates
  the expression the author-facing handle returns through the same prechecks, evaluation
  and output validation production runs: `harness.evaluate(IsAdult(18)).withInput(21)`
  for conditions and transformers, `.withContext(context)` for effects, and generators
  run straight off `evaluate()`. The built-in condition, transformer and generator
  suites now run through it. ([#181])

- **`createTestEffectContext` builds a real effect context for tests.** Effect tests
  previously hand-rolled fake contexts - a `Pick` of whichever getters the effect
  happened to touch, drifting from the real class and its mutation-history behaviour.
  `createTestEffectContext({ answers, data, session, ... })` returns a genuine
  `EffectFunctionContext` over in-memory state, plus `getResponseHeaders()` and
  `getResponseCookies()` to read back what an effect wrote through the response setters.
  ([#181])

---

### For adapter and renderer developers

_Express adapter, Nunjucks renderer, test harness, framework integration_

#### Improvements

- **Forge core now resolves inherited view configuration.** Previously every renderer
  had to combine journey and step `view` config itself - `NunjucksRenderer` walked the
  ancestors for the nearest template and merged locals from root to step. That
  resolution now happens in core's resolve phase: `RenderContext.step.view` arrives as
  the effective view (nearest declared template wins, locals merged by key from the
  root journey down to the step), so renderers just read `context.step.view` and fall
  back to their own default template. Each ancestor's own evaluated view is still on
  `context.ancestors` untouched, and a renderer that still merges them itself lands on
  the same result - so nothing breaks, there's just nothing left to merge. ([#174])

---

### For engine / internal developers

_Compilation, runtime, contracts, diagnostics, instrumentation_

#### Changes

- **Request failures now resolve as error outcomes.** Previously an authored
  `throwError()` result became an outcome, while an exception from a registered function
  rejected `Forge.execute()` and left framework adapters with a second error path.
  Synchronous and asynchronous execution failures now resolve through the same
  `ForgeError` outcome, preserving the original Error's identity, stack, Forge
  diagnostics, custom properties and optional `status` / `statusCode`; non-Error throws
  are wrapped with the original value as their `cause`. The test harness exposes that
  same Error as `result.error`, and the Express adapter forwards it to `next()` after
  defaulting a missing HTTP status to 500. ([#182])

[#174]: https://github.com/ministryofjustice/hmpps-forge/pull/174
[#175]: https://github.com/ministryofjustice/hmpps-forge/pull/175
[#176]: https://github.com/ministryofjustice/hmpps-forge/pull/176
[#180]: https://github.com/ministryofjustice/hmpps-forge/pull/180
[#181]: https://github.com/ministryofjustice/hmpps-forge/pull/181
[#182]: https://github.com/ministryofjustice/hmpps-forge/pull/182

---

## 0.3.2

### For function and component authors

_Conditions, transformers, effects, generators, iterators, component packages_

#### New

- **Nameless registrations use the function's own name.** Previously
  `registry.register(fn)` without an explicit name always registered under a generated
  `__anon_N` name, so diagnostics and runtime errors reported `__anon_3` rather than the
  function that failed. The factory's own `.name` is now used when it has one - which
  covers `const isAdult = deps => ...` as well as named function declarations - with
  `__anon_N` kept for inline arrows. An explicit string name still wins. ([#167])

- **Undefined short-circuits conditions and transformers.** Previously an unanswered
  field flowing into a registered function was only safe when the registration had an
  `inputSchema` - a schemaless condition or any transformer would throw on the undefined
  value and take the request down. Now the engine doesn't call the function at all:
  conditions evaluate to `false`, transformers return `undefined`, and piped chains
  propagate the absence. `null` and wrongly-shaped values behave as before, and bad
  config arguments still throw. ([#168])

#### Breaking changes

- **Duplicate names now throw at registration.** Registering two functions under the
  same name used to silently replace the first. Only breaking if you relied on the
  overwrite - rename one of the pair. ([#167])

[#167]: https://github.com/ministryofjustice/hmpps-forge/pull/167
[#168]: https://github.com/ministryofjustice/hmpps-forge/pull/168

---

## 0.3.1

The devtools release. A Chrome DevTools panel for inspecting Forge requests, with
tracing that only runs for requests a devtools user is actually watching. Plus a batch
of bug fixes out of an audit pass over the tests, guards and conditions.

### For journey authors

_Definitions, expressions, hooks, navigation, reachability_

#### New

- **Forge DevTools.** A Chrome DevTools panel for inspecting Forge requests - profiler
  flame chart, pipeline state with snapshot diffs, resolved block tree with validation,
  and the reachability step graph. The bridge ships under the `/devtools` subpath:
  `setUpForgeDevTools`, register it as an instrumentation sink, attach it to the HTTP
  server. Auth is a one-time code printed to the app's logs, and traces are scoped
  per browser by cookie. Apps running multiple replicas hand `setUpForgeDevTools` their
  Redis client so every pod's traces reach the panel. See the package README for setup
  and the extension install. ([#150], [#152])

#### Fixes

- **Radio groups no longer render two checked radios.** `GovUKRadioInput` computed each
  item's `checked` as the answer match OR the item's own `checked`, so an explicit
  `checked: true` fought the stored answer and `checked: false` could never uncheck
  anything - the browser kept the last checked radio, and the next POST silently flipped
  the answer to whatever was displayed. Precedence now matches the govuk-frontend macro:
  a defined item `checked` wins, otherwise the answer decides. ([#154])
- **A bare Iterate `validWhen` now compiles.** `validWhen` has always accepted a single
  Iterate without the array brackets - the types allow it, the schema allows it, and it
  runs correctly - but the validation-scope rule only understood the array form and
  failed the journey with `validation_outside_valid_when`. ([#154])
- **`Item()` and `Loop` in an iterate's input now fail compilation.** There's no current
  item while the input collection is still being evaluated, but the scope rule miscounted
  the depth and let them through to resolve as `undefined` at runtime. They now fail at
  `registerPackage()` with `item_outside_iterator_scope` / `loop_outside_iterator_scope`.
  ([#154])
- **`Email.IsValidEmail` can no longer be DoS'd.** The old regex backtracked
  catastrophically on long malformed addresses - ~7s of pure CPU for a 2,000 character
  one, and conditions run against POST bodies. Addresses over the RFC 5321 cap of 254
  characters are now rejected before the regex runs, and the pattern is rewritten into a
  linear form. It also stops rejecting real addresses with long TLDs like
  `name@company.engineering` - the old pattern capped TLDs at 6 characters. ([#154])
- **Cleardown no longer wipes answers more than one step ahead.** The reachability walk
  deliberately stopped at the requested step, and cleardown compensated by retaining only
  that step's direct forward edges - so revisiting an early step cleared valid answers
  two or more steps ahead, even though the user could still walk back to them. The walk
  now carries on through the current step, so every step a valid chain reaches keeps its
  answers and cleardown clears only the steps no path reaches. The retention mechanism is
  binned. ([#160])
- **The missing step `title` error now says so.** The diagnostic claimed
  `expected: path property` - a copy-paste from the path check. ([#154])

---

### For engine / internal developers

_Compilation, runtime, contracts, diagnostics, instrumentation_

#### Changes

- **Per-request trace gating.** Instrumentation sinks can declare `shouldTrace(snapshot)` -
  decided once at request start, and a declined request builds no trace at all: no context
  snapshot cloning, no block marking, no trace projection. `RequestEvaluator` resolves the
  sinks that want the request into a request-scoped instrumentation view (`forRequest` on
  `ForgeInstrumentation`), and traces only deliver to the sinks that accepted. Sinks
  without `shouldTrace` trace everything, as before - and compile-time tracing is
  untouched. ([#151])

#### Improvements

- **Split the build and lint configs per package.** `packages/rolldown.config.mjs` had
  grown into a 200-line mix of the library builds, the dts machinery and the whole
  devtools extension build. Each `forge-*` folder now owns its own `rolldown.config.mjs`
  and `eslint.config.mjs` fragment, composed by thin root configs. Package externals and
  the eslint cross-import bans are now derived from a package list - forge-core and
  forge-devtools get the same bans as everyone else. Published output is byte-identical.
  ([#153])

#### Notes

- **Binned two pieces of dead compilation code.** `NodeRegistrationWalker.assignIdsRecursive`
  (the walk after `Self()` resolution already assigns ids and registers the cloned
  subtree) and the reference-scope depth counter (registered references always sit at
  depth 0 - loop bodies are lifted into templates before the rule runs). Removing the
  depth counter is what turned the `Item()`-in-input case above into a compile error.
  ([#154])

[#150]: https://github.com/ministryofjustice/hmpps-forge/pull/150
[#151]: https://github.com/ministryofjustice/hmpps-forge/pull/151
[#152]: https://github.com/ministryofjustice/hmpps-forge/pull/152
[#153]: https://github.com/ministryofjustice/hmpps-forge/pull/153
[#154]: https://github.com/ministryofjustice/hmpps-forge/pull/154
[#160]: https://github.com/ministryofjustice/hmpps-forge/pull/160

---

## 0.3.0

Compilation got a lot stricter - misplaced definitions and unregistered function names now
fail at `registerPackage()` instead of silently vanishing or half-working. Function
registration moves onto registry classes with central schema validation, deprecated APIs
now warn at runtime, and request traces carry a lot more detail for the upcoming
devtools. Compilation now emits trace events of its own, too! Components also now declare
the shape of value they can legitimately submit - a tampered POST body gets dropped
before it ever reaches answer history.

### For journey authors

_Definitions, expressions, hooks, navigation, reachability_

#### Improvements

- **Misplaced definitions now fail compilation.** Previously the AST walker registered
  anything with a matching `type` string, wherever it sat - a step definition inside a
  random property still became a real registered step with a compiled plan and a route,
  and a hook under an unknown key silently vanished without ever compiling. Now placement
  is enforced: steps must sit in their parent journey's `steps` array, journeys at the
  root or in a parent's `children`, blocks in a step's `blocks` array or nested inside
  another block's props, and hooks/tie-breakers/outcomes in their proper containers.
  Anything misplaced fails `registerPackage()` with a pointed error. ([#131])

- **Unregistered function names fail compilation.** Previously a reference to a function
  that wasn't in the registry could compile a call to a function literally named
  `unknown`, or cause the outcome to be skipped silently. Now compilation throws. ([#136])

- **Wrong argument counts fail compilation.** Calls to functions registered with a tuple
  `argumentsSchema` now have their argument counts checked at `registerPackage()` -
  too few or too many fails with a `FunctionArityError` naming the function, the expected
  count and the source location, instead of a `TypeError` mid-request. Iterator templates
  are walked too. ([#142])

- **Unknown component variants inside iterator templates now fail at compile time**
  instead of at render time - `validateRegisteredComponents` walks iterator templates too.
  ([#131])

#### Notes

- **Binned the dead `sanitize` flag.** The DSL schema accepted a `sanitize` boolean on
  field definitions that nothing ever read. Setting it never did anything, and still
  doesn't - the key is now just ignored like any other unknown property. ([#141])

---

### For function and component authors

_Conditions, transformers, effects, generators, iterators, component packages_

#### New

- **Registry classes for function registration.** `ConditionRegistry`,
  `TransformerRegistry`, `GeneratorRegistry` and `EffectRegistry` (on a shared
  `BaseFunctionRegistry`) replace the old define-twice pattern of an interface plus an
  implementations map. Register a function with a name, optional zod schemas
  (`inputSchema`, `argumentsSchema`, `outputSchema`) and a factory, and `build()` produces
  the runtime registry object. All built-in conditions, transformers and generators have
  been migrated, and the developer guide function docs teach the new API. ([#132])

- **Central schema validation at evaluation time.** Validation driven by the registry
  schemas now lives in the engine instead of guard boilerplate at the top of every
  function. Conditions fail soft - a value that doesn't match `inputSchema` (an
  unanswered field, the wrong shape) returns `false` rather than throwing, since that's a
  normal "not valid yet" outcome. Everything else throws - bad arguments on any function
  kind, or a transformer fed a value it can't take, is an author mistake. ([#132])

- **Components can declare an input schema.** A component registry entry can carry a Zod
  `inputSchema` describing the submitted value the rendered component can legitimately
  produce (a text input submits a string, a date input submits date parts), plus an
  optional `multiple` flag. Answer preparation validates the normalized POST value against
  the schema: a value that fails is not from the rendered form, so it is dropped as
  unanswered - `undefined`, or `[]` when multiple. Unanswered fields and variants
  without a schema are untouched. ([#141])

#### Improvements

- **Checkbox `multiple` moves to the component registry entry.** The checkbox component
  now declares `multiple: true` on its registry entry rather than forcing it onto the
  field definition. Effective multiple is `entry.multiple ?? field.multiple ?? false`, so
  fixed-shape components own the flag while dual-mode components keep the field-level DSL
  option. ([#141])

#### Deprecated

- **`defineFunction`, the `define*Functions` utilities and `createFunctionScope`.**
  Replaced by the registry classes above. The shapes-type-plus-implementations-map pair
  becomes one `register()` call per function, which returns the expression handle
  directly:

  ```ts
  // Before
  const { effects: MyEffects, implementations } = defineEffectFunctions<Shapes, MyDeps>({ loadPlan })

  createForgePackage({ journey, functions: implementations })

  // After
  const registry = new EffectRegistry<MyDeps>()
  const MyEffects = { loadPlan: registry.register('loadPlan', myEffectFn) }

  createForgePackage({ journey, functions: registry })
  ```

  Note `functions` takes an implementations map or registries, never a mix - a package
  that spreads effects and transformers into one map moves both at once
  (`functions: [effectRegistry, transformerRegistry]`). The old utilities still work but
  warn once per process via `process.emitWarning`, so Node's `--trace-deprecation` /
  `--throw-deprecation` / `--no-deprecation` flags all apply.
  ([#132], [#135])

---

### For adapter and renderer developers

_Express adapter, Nunjucks renderer, test harness, framework integration_

#### New

- **Compilation trace events.** `ForgeInstrumentationSink` gains an optional
  `onCompilationTrace(event)` - one `CompilationTraceEvent` per `registerPackage()`, with
  per-phase timings (`dsl-validation`, `ast`, `semantic-analysis`, `dependency-analysis`,
  `lowering`, `routes`), nested codegen spans per journey/step/compiled function, and
  error detail when registration fails (emitted even under strict registration, before
  the throw). Set `ForgeInstrumentationOptions.captureGeneratedSource` to attach the
  generated JavaScript source to each codegen span - verbose, so opt-in. Note:
  `ForgeInstrumentation` (the dispatcher-side interface) gained a required
  `onCompilationTrace` and a readonly `captureGeneratedSource` - breaking only for
  external implementers of that interface; sinks are unaffected. ([#138])

- **Renderers can mark blocks for devtools.** The renderer contract gains an optional
  `markBlock(nodeId, output)` - the orchestrator calls it once per rendered block (nested
  blocks included), and only while the request is being traced, so untraced production
  output is never touched. It tags the block's output with an out-of-band marker tying it
  back to its `nodeId` - for an HTML renderer, paired `<!--forge:<nodeId>-->` comments -
  which is what the devtools panel uses to find and highlight a block on the page.
  Renderers whose output can't carry an invisible marker just omit the method. ([#145])

#### Improvements

- **Request traces carry a lot more detail.** `RequestTraceEvent`s (and phase and
  work
  unit traces) now include `startedAtMs`/`completedAtMs`/`durationMs`, the resolved route
  context (journey code and title, step title, route template path), the redirect target,
  and unwrapped error detail (status, message, stack - the `WorkExecutionError` chain is
  unwrapped before emission). `resolve.block` completions re-emit the materialised
  `RenderBlock` properties. ([#137])

- **Work units track `selfDurationMs`.** Only time spent synchronously inside the unit's
  own `begin`/`complete` - previously siblings in a `concurrent` group billed each other's
  queue wait, so 15 render blocks in a ~7ms phase each reported ~6.6ms. ([#137])

- **Deprecation warnings on the old setup pattern.** `getRouter()` (which previously
  warned on every single call) and `ExpressFrameworkAdapter.configure()` now warn once
  per process each, with `FORGE_DEP_*` codes so Node's `--trace-deprecation` /
  `--no-deprecation` flags apply. ([#135])

---

### For engine / internal developers

_Compilation, runtime, contracts, diagnostics, instrumentation_

#### Changes

- **Semantic analysis gains placement and membership rules.** New `validateStructureScope`
  and `validateBlockScope` rules, and `validateHookScope`, `validateTieBreakerScope` and
  `validateOutcomeScope` upgraded from parent-type checks to container membership - the
  walker parents a node to whatever contained it, so a hook under a step's unknown key
  used to pass the type check and then never compile. ([#131])

- **Dead defensive code removed across the compilation layer.** The `!parentJourneyId`
  guards and undefined-journey handling are gone from dependency-analysis - a step's
  parent is always a registered journey now (the placement rules above are what made the
  removals legal), so the signatures say so. Lowering's silent skips are now throws, and
  the `visited` cycle machinery is stripped from `RequestTimeReferenceAnalyzer` since the
  AST is acyclic by construction. Engine source is net negative. ([#136])

- **`ForgeDeprecations` helper.** Warns once per process per code via
  `process.emitWarning`. The seen-codes set lives on `globalThis` under a `Symbol.for`
  key, since each rolldown entry bundles its own copy of the module.
  `ExpressFrameworkAdapter.configure()` gets its own small local copy rather than
  exposing `ForgeDeprecations` publicly. ([#135])

- **Work-unit trace primitives extracted and renamed.** `WorkUnit`, its serialiser and
  the trace-facing contract types moved out of the runtime work model into
  `engine/diagnostics/tracing/` as `TraceSpan`, `TraceSpanSerializer`,
  `SerializedTraceSpan` and `TraceSpanFields`, so compilation and runtime share one trace
  data model without the compilation layer depending on runtime. The public `RequestTraceUnit`
  union is structurally unchanged. ([#138])

- **Compilation emits per-phase spans.** `CompilationPipeline` and `CodegenOrchestrator`
  wrap their work in `CompilationTracer` spans (a plain synchronous span stack - no
  `WorkExecutor` involvement), and `compileGeneratedFunction` records one
  `codegen.function` span per compiled function at the single choke point where the
  generated source already exists. Zero overhead when no sinks are registered. ([#138])

- **Request traces carry the reachability evaluation.** `RequestTrace` gains an optional
  `reachability` - a projection of the request's `ReachabilityEvaluation` with the
  journey-level facts (canonical path, frontier, resume outcome, unreachable redirect)
  plus a node per step. Redirect traces carry it too, which is the interesting case when
  debugging why a request bounced. Every array is copied rather than aliased - traces are
  buffered immutable records and the graph builder mutates the live evaluation's arrays
  in place. `cleardownRetentionRouteTemplatePaths` is deliberately not projected. ([#145])

[#131]: https://github.com/ministryofjustice/hmpps-forge/pull/131
[#132]: https://github.com/ministryofjustice/hmpps-forge/pull/132
[#135]: https://github.com/ministryofjustice/hmpps-forge/pull/135
[#136]: https://github.com/ministryofjustice/hmpps-forge/pull/136
[#137]: https://github.com/ministryofjustice/hmpps-forge/pull/137
[#138]: https://github.com/ministryofjustice/hmpps-forge/pull/138
[#141]: https://github.com/ministryofjustice/hmpps-forge/pull/141
[#142]: https://github.com/ministryofjustice/hmpps-forge/pull/142
[#145]: https://github.com/ministryofjustice/hmpps-forge/pull/145

---
<br>

## 0.2.0

The engine internals have been pretty much rewritten - compilation is now properly scoped
into phases, reachability is compiled at startup instead of rebuilt per request, and the
runtime evaluates through a work tree model.

---

### For journey authors

_Definitions, expressions, hooks, navigation, reachability_

#### Breaking changes

- **Expressions are no longer allowed in static `data`.** `data` on journeys and steps is
  now compiled at startup. If you were using expressions (e.g. `Answer()`, `Data()`)
  inside `data`, move them to an `onAccess` effect that calls `context.setData()` instead.

- **`getPostData()` now requires a key.** Previously calling it with no arguments returned
  the whole POST body - use `getAllPostData()` for that instead. `getAnswer`, `getData`,
  `getPostData`, and `getAllPostData` also accept call-level generic type hints now (e.g.
  `getAnswer<string>('fullName')`) - these are TypeScript hints only, not runtime
  validation.

#### New

- **Dynamic `title`, `description`, and `metadata` on journeys and steps.** These can now
  be expressions (e.g. `Answer()`, `Data()`) instead of static strings. Previously they
  had to be hardcoded values - now they're resolved at request time like any other
  expression.

- **Request tracing via instrumentation sinks.** Pass `instrumentation: { sinks: [...] }`
  when constructing `Forge` to receive `RequestTraceEvent`s after each request - includes
  the full work unit trace tree, outcome, and per-phase context snapshots. Tracing
  overhead is skipped entirely when no sinks are configured.

- **`createExpressRouter` is now the recommended setup.** Import from
  `@ministryofjustice/hmpps-forge/express-nunjucks` and call it directly - returns a typed
  `express.Router` without the `forge.getRouter() as express.Router` cast the old pattern
  needed.

#### Deprecated

- **`new Forge({ frameworkAdapter: ExpressFrameworkAdapter.configure(...) })` and
  `forge.getRouter()`.** The adapter options move onto the router call, and the
  `as express.Router` cast goes:

  ```ts
  // Before
  const forge = new Forge({ frameworkAdapter: ExpressFrameworkAdapter.configure({ nunjucksEnv }) })
  app.use(forge.getRouter() as express.Router)

  // After
  const forge = new Forge()
  app.use(createExpressRouter(forge, { nunjucksEnv }))
  ```

  The old pattern still works but logs a warning.

#### Fixes

- **Conditions now return `false` for absent field values instead of throwing.**
  Previously, calling a condition (e.g. `Condition.String.MinLength()`) on a field with no
  answer would throw a `TypeError`. Now all built-in conditions return `false` when the
  value is `undefined` or `null`, which means validation rules on optional fields work
  without needing a separate "is present" guard.

#### Notes

- The engine now runs eager validation checks across all steps in a journey, not just the
  current page. This means a poorly configured validation (e.g. a condition that assumes a
  value is always present) can throw even on steps the user hasn't reached yet. The
  condition fix above addresses the most common case, but custom conditions that don't
  handle `undefined`/`null` inputs will need updating.

- Request tracing comes with both a performance hit and a security risk. It's
  quite useful for debugging locally, and it will eventually power Forge's
  devtools solution, but we would advise against using it unless you want to
  debug something specific in Forge's runtime. Also worth noting it currently
  does not cover any of Forge's compilation stage.

---

### For function and component authors

_Conditions, transformers, effects, generators, iterators, component packages_

No changes in this release.

---

### For adapter and renderer developers

_Express adapter, Nunjucks renderer, test harness, framework integration_

#### Breaking changes

- **`ForgeOrchestrator` removed.** The orchestrator layer is gone entirely. `Forge` now
  exposes `execute()` directly - pass it a `ForgeExecutionRequest` (snapshot, optional
  renderer, optional response bindings) and get back a `ForgeOutcome`. Adapters that were
  calling `new ForgeOrchestrator({ core: forge, renderer })` should call `forge.execute()`
  instead.

- **`evaluate()` renamed to `execute()`.** The method on `Forge` is now `execute(request)`
  instead of `evaluate(snapshot, options)`. The arguments are bundled into a single
  `ForgeExecutionRequest` object.

---

### For engine / internal developers

_Compilation, runtime, contracts, diagnostics, instrumentation_

#### Improvements

- **Express adapter internals reworked.** The public API
  (`createExpressRouter(forge, options)`) hasn't changed, but if you were importing
  internals from the adapter package (snapshot builders, response binding factories),
  those have moved into `ExpressHandlerFactory`. ([#117])

- **Request trace logging.** The runtime now captures a full trace of each request's work
  unit tree and context snapshots per phase. `ForgeTraceSinkDispatcher` fans events out to
  configured sinks, and `RequestPipelineTraceProjector` serialises the trace after each
  request. Trace capture is gated behind `instrumentation.enabled` so there's no overhead
  when no sinks are registered. ([#117])

- **Reachability is now compiled, not rebuilt per request.** Previously the reachability
  graph was evaluated fresh every request. It's now compiled once at startup, so
  request-time evaluation just runs the compiled functions against the current context.
  Should be noticeably faster for journeys with complex navigation. ([#122])

- **Work-based runtime evaluation.** The runtime now evaluates through a work tree -
  generated functions return `WorkTask` descriptions that the `WorkExecutor` runs
  (sequential, concurrent, first-match groups). This replaces the old phase-by-phase
  orchestrator and makes the execution model explicit and traceable. ([#117])

- **Standardised diagnostics and error formatting.** Error messages from compilation and
  runtime are now consistent in format. ([#117])

- **Compilation scoped into proper passes.** AST building, semantic analysis, dependency
  analysis, and lowering are now clearly separated stages in `CompilationPipeline`,
  replacing the old `JourneyCompiler`. Each stage has explicit boundaries enforced by
  eslint. ([#117], [#123])

- **Test client restructured.** `ForgeTestClient` and its supporting types have moved into
  `testing/test-client/`. The client now works against `forge.execute()` instead of the
  removed orchestrator. `ForgeTestHarness` is updated to match. ([#117], [#129])

- **Compiled context types renamed.** The phase-specific context types
  (`ValidationContext`, `AnswerPreparationContext`, `ReachabilityContext`, etc.) are
  replaced by a `CompiledBaseContext` family (`CompiledValidationContext`,
  `CompiledResolveContext`, `CompiledAnswerPreparationContext`, etc.). ([#129])

- **Navigation types renamed.** `NavigationPathAnalysis` is now
  `ReachabilityPathAnalysis`. `NavigationStepState` is now `ReachabilityNode`.
  `JourneyReachabilityState` and the old `NavigationEvaluation*` types are removed in
  favour of the new reachability contracts. ([#122])

- **Route topology separated from route metadata.** `ForgeTopology` now returns route
  structure only. Route metadata (resolved expressions attached to routes) is accessed
  through the new `CompiledRouteMetadataFunction`. ([#124])

[#117]: https://github.com/ministryofjustice/hmpps-forge/pull/117
[#122]: https://github.com/ministryofjustice/hmpps-forge/pull/122
[#123]: https://github.com/ministryofjustice/hmpps-forge/pull/123
[#124]: https://github.com/ministryofjustice/hmpps-forge/pull/124
[#129]: https://github.com/ministryofjustice/hmpps-forge/pull/129
