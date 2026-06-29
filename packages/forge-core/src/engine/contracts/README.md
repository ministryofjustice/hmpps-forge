# contracts - the shared vocabulary

Contracts is where the engine's types live. It contains no logic - just
interfaces, type aliases, enums, and type guard functions. Every other engine
layer imports from here; contracts imports from none of them.

## Why a separate layer?

Without contracts, the layers would import types from each other and create
circular dependencies. `lowering/` needs to know what a `CompiledResolveFunction`
looks like so it can produce one; `runtime/` needs to know the same type so it
can call one. If either layer owned the type, the other would have to import
from it - and the boundary would break.

Contracts solves this by owning the types that cross layer boundaries. Each layer
depends on contracts and never on each other. The types are the shared language
the pipeline speaks.

## What's in each sub-folder

| Folder | What it defines |
|--------|-----------------|
| [`ast/`](./ast/) | AST node types (`ASTNode`, `JourneyASTNode`, `StepASTNode`, `ExpressionASTNode`, etc.), the `ASTNodeType` enum, and type guard functions (`isReferenceExprNode`, `isFieldBlockStructNode`, etc.) |
| [`compiled/`](./compiled/) | Compiled function signatures (`CompiledResolveFunction`, `CompiledValidationFunction`, `CompiledReachabilityFactsFunction`, etc.), the phase context types each function receives (`CompiledValidationContext`, `CompiledResolveContext`, `CompiledAnswerPreparationContext`, all extending `CompiledBaseContext`), and the render block brand symbol |
| [`plans/`](./plans/) | `CompilationPlan` (the handoff from planner to codegen), `StepRuntimePlan` / `JourneyRuntimePlan` / `ReachabilityStateTable` (minimal metadata that survives into runtime), and the compiled artefact wrappers (`CompiledStep`, `CompiledJourney`) |
| [`navigation/`](reachability/) | `ReachabilityEvaluation` and `JourneyReachabilityProjection` (the result of evaluating reachability at request time), plus the input/output types for the compiled reachability function (`ReachabilityEvaluationInput` / `ReachabilityEvaluationResult`) |
| [`routing/`](./routing/) | Route descriptors (`JourneyRouteDescriptor`, `StepRouteDescriptor`), the route tree structures (`StoredRouteTreeNode`, `RouteTreeIndex`), and the route template catalog |
| [`runtime/`](./runtime/) | Request-scoped state types: `AnswerHistory` (the mutation log), `RuntimeContext`, `StepValidityResult`, `ValidationResult`, `CompiledHookLifecycleContext`, `HookEffectWorkProps` |

## How it's used

You'll rarely work *in* contracts directly - most changes start in the layer
that needs a new type, and you add the contract here so the other layers can see
it. The typical flow:

1. Define the type in the appropriate contracts sub-folder
2. Import it in the producing layer (e.g. `lowering/`) and the consuming layer
   (e.g. `runtime/`)
3. Neither layer imports the other - both import contracts

Contracts may not import from any `compilation/` layer (`ast/`, `semantic-analysis/`, `dependency-analysis/`, `lowering/`) or from `runtime/` - enforced by eslint, so a stray import fails the build.
