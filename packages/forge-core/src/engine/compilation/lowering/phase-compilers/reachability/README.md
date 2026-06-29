# Reachability Compilers

## Scope

This document covers `packages/forge-core/src/engine/compilation/lowering/phase-compilers/reachability`.

This code compiles reachability, navigation, and navigation field inventory.
It emits functions that evaluate reachability facts and return navigation `WorkTask`s.

This document does not cover reachability plan construction or runtime navigation handling.

## Inputs

`ReachabilityCompiler.compileFacts()` receives:
- a `ReachabilityCompilationPlan`.
- field inventory sources.
- `ASTNodeIndex`.

`StepFieldInventoryCompiler` receives field inventory sources and emits field-code collection logic.

## Work Returned

`compileFacts()` returns a `CompiledReachabilityFactsFunction`.
That function returns a `CompiledReachabilityResult` (the dynamic facts), not a `WorkTask`.

Field inventory is emitted into the result when request params are available.

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
- To change the facts function shape, start in `buildFactsSource()`.
- To change field inventory behavior, start in `StepFieldInventoryCompiler`.
- To inspect generated source, use `generateFactsSource()` in the tests.

## Entry Points

- [ReachabilityCompiler.ts](ReachabilityCompiler.ts) emits reachability and navigation source.
- [StepFieldInventoryCompiler.ts](StepFieldInventoryCompiler.ts) emits field inventory source for navigation.
