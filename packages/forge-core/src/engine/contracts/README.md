# contracts - the shared vocabulary

Contracts is where the engine's kernel types live. It contains no logic - just
interfaces, type aliases, enums, and type guard functions. Every other engine
layer imports from here; contracts imports from no layer, only from other
runtime-free contracts.

Types that only one concern's stages share moved out to `concerns/<name>/contracts/`
and follow the same rule there - a runtime-free sink that imports no analysis,
lowering, or runtime code. What stays here is what crosses concerns or has no
concern at all: the AST, compiled function signatures, plans and compiled
artefacts, and the runtime plumbing (`RuntimeContext`, `AnswerHistory`,
`WorkTask`, the request pipeline types).

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
| [`compiled/`](./compiled/) | Compiled function signatures (`CompiledResolveFunction`, `CompiledValidationFunction`, `CompiledReachabilityFactsFunction`, `CompiledRouteMetadataFunction`, etc.) and the phase context types each function receives (`CompiledValidationContext`, `CompiledResolveContext`, `CompiledAnswerPreparationContext`, `CompiledRouteMetadataContext`, all extending `CompiledBaseContext`) |
| [`models/`](./models/) | The semantic model analysis hands to lowering: `CompilationModel` / `JourneyModel` / `StepModel`, `FieldModel`, and the shared `AuthoredValue` types and guards |
| [`plans/`](./plans/) | `StepMountInfo` / `JourneyMountInfo` (the identity and route path that survive into runtime), and the compiled artefact wrappers (`CompiledStep`, `CompiledJourney`) |
| [`runtime/`](./runtime/) | Request-scoped plumbing: `AnswerHistory` (the mutation log), `RuntimeContext`, the request phase props, `WorkTask` and the work output registry, and trace types |

Where the concern-owned types went:

| Type | Now in |
|------|--------|
| `ReachabilityEvaluation`, `JourneyReachabilityProjection`, the compiled reachability input/output types | [`concerns/reachability/contracts/`](../concerns/reachability/contracts/) |
| Route descriptors, the route tree structures, the route template catalog | [`concerns/route/contracts/`](../concerns/route/contracts/) |
| `StepValidityResult`, `ValidationResult`, `ValidationView`, the validation work props | [`concerns/validation/contracts/`](../concerns/validation/contracts/) |
| `CompiledHookLifecycleContext`, `HookEffectWorkProps`, the hook lifecycle and stage types | [`concerns/hooks/contracts/`](../concerns/hooks/contracts/) |
| The render block brand symbol | [`concerns/render/contracts/`](../concerns/render/contracts/) |
| Answer-preparation work props, `ResolveBlocksOutput`, the step field inventory | the matching concern's `contracts/` folder |

## How it's used

You'll rarely work *in* contracts directly - most changes start in the layer
that needs a new type, and you add the contract here so the other layers can see
it. The typical flow:

1. Define the type in the appropriate contracts sub-folder
2. Import it in the producing layer (e.g. `lowering/`) and the consuming layer
   (e.g. `runtime/`)
3. Neither layer imports the other - both import contracts

Add the type here only when more than one concern needs it, or when no concern owns it. A type used by one
concern's analysis, lowering, and runtime belongs in that concern's `contracts/` folder.

The kernel types do reach into `concerns/*/contracts/` - the work output registry has to name every concern's
output type, and `CompiledStep` has to name every compiled function. That is allowed because concern contracts are
runtime-free sinks too, so the dependency never picks up logic.

Contracts may not import from any `compilation/` layer (`ast/`, `analysis/`, `lowering/`), from `concerns/semantic-analysis/`, or from `runtime/` - enforced by eslint, so a stray import fails the build.
