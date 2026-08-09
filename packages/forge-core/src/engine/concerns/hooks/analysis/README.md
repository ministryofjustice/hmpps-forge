# Hook Inputs

## Scope

This document covers `packages/forge-core/src/engine/concerns/hooks/analysis`.

This code builds the dependency-analysis inputs for hook lowering.
It resolves which access hooks and submit hooks apply to a step or journey.

This document does not cover hook execution, hook result handling, or generated code.

## Inputs Built

`HookInputAnalyzer.buildInputs()` returns `HookInputs` for one step:
- `accessHooks`, flattened from ancestor journeys through the step.
- `submitHooks`, read from the step's own `onSubmission` property.

`HookInputAnalyzer.resolveAccessHooks()` can also be used for a journey node.
`CompilationPlanBuilder.buildJourneyInputs()` uses it to attach journey access hooks to `JourneyCompilationInputs`.

## Rules

- Access hooks inherit down the journey tree.
  The order is outer journey, child journey, then step.
- Submit hooks do not inherit.
  They belong to the step that declares them.
- Only journeys and steps are access-hook ancestors.
  Blocks and expressions are not hook inheritance boundaries.

## Editing Notes

- To change access hook inheritance, start in `HookInputAnalyzer.resolveAccessHooks()`.
- To change submit hook behavior, update `HookInputAnalyzer.buildInputs()` and the hook lowering phase together.
- Do not add inherited submit hooks unless runtime hook semantics also change.

## Entry Points

- [HookInputAnalyzer.ts](HookInputAnalyzer.ts) builds hook inputs and resolves inherited access hooks.
- [CompilationPlanBuilder.ts](../../../compilation/dependency-analysis/CompilationPlanBuilder.ts) calls `buildInputs()` for steps and `resolveAccessHooks()` for journeys.
