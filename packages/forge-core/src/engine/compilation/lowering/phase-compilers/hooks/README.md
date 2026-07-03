# Hook Lifecycle Compiler

## Scope

This document covers `packages/forge-core/src/engine/compilation/lowering/phase-compilers/hooks`.

This code compiles access hooks and submit hooks.
It emits lifecycle functions that return hook `WorkTask`s.

This document does not cover hook input selection or runtime hook handler execution.

## Inputs

`HookLifecycleCompiler.compileAccessLifecycle()` receives inherited access hooks.

`HookLifecycleCompiler.compileSubmitHooks()` receives submit hooks for one step.

Dependency analysis decides which hooks apply.
Lowering decides how those hooks become executable work.

## Work Returned

Access compilation returns:
- `ctx.workTasks.accessLifecycle(accessHooks)`.
- child `accessHook`, `accessHookWhen`, and `hookEffect` tasks.

Submit compilation returns:
- `ctx.workTasks.submitLifecycle(submitHooks)`.
- child `submitHook`, `submitPredicate`, `submitBranch`, `submitValidation`, and `hookEffect` tasks.

Generated hook functions build tasks and branch callbacks.
The runtime executor runs the lifecycle and selects children.

## Rules

- Hook lifecycles force async.
  Effects are always awaited - probably should come back and fix this at some point!
- Access hooks run in the order dependency analysis provides them.
  That order is outer journey to current step.
- Submit hook `validationGroups` default to `['default']` when no groups are configured.
- Submit validation is only added when `hook.properties.validate` is true.
- Outcomes are compiled as async functions.
  Redirect and throw-error outcomes are selected by their `when` predicates.

## Editing Notes

- To change access hook work shape, start in `compileAccessHookTask()`.
- To change submit hook work shape, start in `compileSubmitHookTask()`.
- To change effect calls, start in `compileEffectRunFunction()` and `compileAwaitedEffectCall()`.
- To change outcome behavior, start in `compileOutcomeAssignment()`.
- To inspect generated source, use `generateAccessSource()` or `generateSubmitSource()` in the tests.

## Entry Points

- [HookLifecycleCompiler.ts](HookLifecycleCompiler.ts) emits access and submit lifecycle source.
