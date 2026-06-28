# Reachability Compilers

## Scope

This document covers `packages/forge-core/src/engine/compilation/lowering/phase-compilers/reachability`.

This code compiles reachability, navigation, and navigation field inventory.
It emits functions that evaluate reachability facts and return navigation `WorkTask`s.

This document does not cover reachability plan construction or runtime navigation handling.

## Inputs

`ReachabilityCompiler.compile()` receives a `ReachabilityCompilationPlan` and `ASTNodeIndex`.

`ReachabilityCompiler.compileNavigation()` receives:
- a `ReachabilityCompilationPlan`.
- field inventory sources.
- `ASTNodeIndex`.

`StepFieldInventoryCompiler` receives field inventory sources and emits field-code collection logic.

## Work Returned

`compile()` returns a `CompiledReachabilityFunction`.
That function returns a `CompiledReachabilityResult`, not a `WorkTask`.

`compileNavigation()` returns a `CompiledNavigationFunction`.
That function returns:
- `ctx.workTasks.reachabilityEvaluation(navigationInput, compiledResult)`.

Field inventory is emitted into the navigation input when request params are available.

## Rules

- Reachability result arrays are indexed by `plan.entries` order.
  Keep entry order stable.
- Forward outcome groups preserve submit-hook grouping.
  The cascade resets between hook groups.
- Over-approximated outcomes stay possible when their guards cannot be evaluated exactly.
- Resume conditions and tie-breakers are evaluated into the reachability result.
- Field inventory includes static field codes, dynamic field codes, cleardown codes, and field codes from map iterator templates.

## Editing Notes

- To change reachability result shape, start in `ReachabilityCompiler.compileReachabilityResult()`.
- To change forward outcome evaluation, start in `compileForwardOutcomes()` and `compileForwardOutcomeGroup()`.
- To change navigation work shape, start in `buildNavigationSource()`.
- To change field inventory behavior, start in `StepFieldInventoryCompiler`.
- To inspect generated source, use `generateSource()` or `generateNavigationSource()` in the tests.

## Entry Points

- [ReachabilityCompiler.ts](ReachabilityCompiler.ts) emits reachability and navigation source.
- [StepFieldInventoryCompiler.ts](StepFieldInventoryCompiler.ts) emits field inventory source for navigation.
