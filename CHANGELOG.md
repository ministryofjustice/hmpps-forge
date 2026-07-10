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
=======
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
  Moved to a `deprecated` folder with `@deprecated` markers - they still work, but now
  emit a once-per-process runtime warning via `process.emitWarning`, so Node's
  `--trace-deprecation` / `--throw-deprecation` / `--no-deprecation` flags all apply.
  Removal comes in a later release. Use the registry classes above instead.
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
  warned on every single call)

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
  `forge.getRouter()`.** This setup pattern still works but logs a warning and will be
  removed in a future release. See `createExpressRouter` under **New** above.

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
