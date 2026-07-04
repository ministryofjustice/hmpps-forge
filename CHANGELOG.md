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
#### Deprecated
#### New
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

#### Deprecated

- **`new Forge({ frameworkAdapter: ExpressFrameworkAdapter.configure(...) })` and
  `forge.getRouter()`.** This setup pattern still works but logs a warning and will be
  removed in a future release. See `createExpressRouter` under **New** below.

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
