# Hook Analysis

## Scope

This document covers `packages/forge-core/src/engine/concerns/hooks/analysis`.

This code builds the hooks concern's semantic model for hook lowering.
It resolves which access and submit hooks apply to a step or journey and classifies each hook's
guards, effects, and outcomes into typed model shapes.

This document does not cover hook execution, hook result handling, or generated code.

## Models Built

`HookAnalyzer.analyzeStep()` returns a `StepHookModel`:
- `access`, the inherited access hooks flattened from ancestor journeys through the step.
- `submit`, the step's own `onSubmission` hooks with guards, validation groups (defaulted to
  `['default']`), branches, effects, and outcomes classified.

`HookAnalyzer.analyzeJourney()` returns a `JourneyHookModel` with the journey's inherited access hooks.
`CompilationModelBuilder` calls both through the analyzer family interfaces.

Hook and effect work-task keys (`access-hook-0`, `submit-hook-1-onAlways-effect-0`) and
generated-comment labels are stamped here, so lowering derives nothing from the AST.

## Rules

- Access hooks inherit down the journey tree.
  The order is outer journey, child journey, then step.
- Submit hooks do not inherit.
  They belong to the step that declares them.
- Only journeys and steps are access-hook ancestors.
  Blocks and expressions are not hook inheritance boundaries.
- Non-effect nodes in `effects` and non-outcome nodes in `next` are dropped during classification.

## Editing Notes

- To change access hook inheritance, start in `HookAnalyzer.analyzeStep()`.
- To change submit hook behavior, update `HookAnalyzer` and the hook lowering phase together.
- Do not add inherited submit hooks unless runtime hook semantics also change.

## Entry Points

- [HookAnalyzer.ts](HookAnalyzer.ts) builds the hook models and resolves inherited access hooks.
- [CompilationModelBuilder.ts](../../../chassis/compilation/analysis/CompilationModelBuilder.ts) calls `analyzeStep()` for steps and `analyzeJourney()` for journeys.
