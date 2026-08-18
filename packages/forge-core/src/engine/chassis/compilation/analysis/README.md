# Analysis

## Scope

This document covers `packages/forge-core/src/engine/chassis/compilation/analysis`.

This code reads the registered AST and builds the `CompilationModel` that lowering consumes.
It owns model assembly, the analyzer family contracts, and the shared services every concern analyzer is built on.

The per-concern analyzers live with their concern, under `concerns/<name>/analysis`.
`CompilationModelBuilder` calls them; this folder holds the walk that does the calling and the shared services the
analyzers receive through their contexts.

This document does not cover AST creation, semantic validation, JavaScript generation, runtime
execution, or route index construction.

## Background

Analysis is the compiler pass that turns a whole AST into a semantic model.

The AST tells us everything that exists in the journey. But lowering - the next stage, which writes JavaScript
source for each runtime phase - should not be asking semantic questions like "which of these properties is a
transformer call?" or "does this field's component validate input?" while it emits. Analysis answers every such
question once and records the answer as a typed model, so each phase compiler maps model fields onto the IR and
does nothing else.

The stage is governed by one boundary rule: **past analysis there is no `unknown` and no structural AST
querying**. AST nodes survive only as expression leaves (handed to `ExpressionDispatcher`) and diagnostic tokens
(labels, callsites, source-map positions).

## Responsibilities

- Build one `CompilationModel` per package: route metadata for every node plus one `JourneyModel` per journey,
  each owning its `StepModel`s.
- Bucket the registered AST by owning step and journey in one pass (`OwnershipIndex`).
- Answer every ancestor question through the three named inheritance patterns (`Ancestry`).
- Classify every field occurrence - registered blocks and template fields under MAP iterators - into
  `FieldModel`s once (`FieldModelBuilder`).
- Stamp script-URL and generated-comment labels from diagnostics (`NodeLabeller`).
- Build mount info (identity + route path) and merged static data for steps and journeys (`MountInfoAnalyzer`).
- Call each concern's analyzer through the family interfaces and assemble their models into the spine.

## The analyzer family

Every concern analyzer implements one or both of two interfaces declared in
[concernAnalyzers.type.ts](concernAnalyzers.type.ts):

- `StepModelAnalyzer<TModel>` — `analyzeStep(context: StepAnalysisContext): TModel`
- `JourneyModelAnalyzer<TModel>` — `analyzeJourney(context: JourneyAnalysisContext): TModel`

Family rules:

- Analyzers are zero-collaborator: the constructor takes nothing; everything arrives in the context
  (ownership index, ancestry, registries, the step's field models, the labeller).
- Analyzers are total: they throw `ForgeInternalError` for impossible states only.
  Semantic analysis remains the only authoring-error gate.
- Concern analyzers never import the shared services directly — they receive them via context.
- Each analyzer produces its concern's model, declared in that concern's `contracts/` folder.

Someone who has read one analyzer can predict the layout of the rest.

## Data Model

`CompilationModel` is the main output, declared in
[../../contracts/models/compilationModel.type.ts](../../contracts/models/compilationModel.type.ts):

- `routeMetadata`, keyed by step or journey node ID — every node, container journeys included.
- `journeys`, keyed by journey node ID — every journey; a container journey has an empty `steps` map.

`JourneyModel` contains the journey's label, runtime plan, merged `staticData`, and the journey-scoped concern
models: `hooks` (`JourneyHookModel`), `reachability` (`ReachabilityModel`), `cleardown` (`CleardownModel`),
`answerPreparation`, plus `steps` — a map of `StepModel` in document order, which is also the reachability
state table's order.

`StepModel` contains the step's label, runtime plan, merged `staticData`, its `fields` (every `FieldModel`
occurrence the step owns — concern models hold projections of these), and the step-scoped concern models:
`answerPreparation`, `hooks` (`StepHookModel`), `validation` (`ValidationModel`), and `resolve` (`ResolveModel`).

Ownership is structure: a step lives inside its journey's map, so lowering never joins flat maps by `NodeId`.

### Example

A journey with two steps starts as registered AST nodes:

```jsonc
{
  journey: {
    id: 'compile_ast:1',
    type: 'AstNode.Journey',
    properties: { path: '/travel-declaration', code: 'travel-declaration' },
  },
  steps: [
    {
      id: 'compile_ast:2',
      type: 'AstNode.Step',
      properties: { path: '/personal-details', code: 'personal-details' },
    },
    {
      id: 'compile_ast:3',
      type: 'AstNode.Step',
      properties: { path: '/summary', code: 'summary' },
    },
  ],
}
```

`CompilationModelBuilder.build()` produces one hierarchical model:

```jsonc
{
  routeMetadata: Map {
    'compile_ast:1' => { nodeId: 'compile_ast:1', title: 'Travel declaration' },
    'compile_ast:2' => { nodeId: 'compile_ast:2', title: 'Personal details' },
    'compile_ast:3' => { nodeId: 'compile_ast:3', title: 'Summary' },
  },
  journeys: Map {
    'compile_ast:1' => {
      journeyId: 'compile_ast:1',
      label: 'travel-declaration',
      mountInfo: { journeyId: 'compile_ast:1', path: 'travel-declaration' },
      staticData: {},
      hooks: { access: { label: ..., hooks: [...] } },
      reachability: { label: ..., stateTable: { entries: [...] }, entries: [...], resumeAlways: false },
      cleardown: { steps: [...] },
      answerPreparation: { label: ..., fields: [...] },
      steps: Map {
        'compile_ast:2' => {
          stepId: 'compile_ast:2',
          label: 'travel-declaration.personal-details',
          mountInfo: { stepId: 'compile_ast:2', path: 'personal-details' },
          staticData: {},
          fields: [...],
          answerPreparation: { label: ..., fields: [...] },
          hooks: { access: { ... }, submit: { ... } },
          validation: { label: ..., hasValidation: true, fields: [...], entryValidation: [...] },
          resolve: { stepNode: ..., ancestorJourneys: [...], allIterateNodes: [...] },
        },
        'compile_ast:3' => { ... },
      },
    },
  },
}
```

The important transform is not changing AST nodes.
It is turning one tree into the typed semantic model each lowering compiler maps onto the IR.

## Flow

Analysis starts when `CompilationModelBuilder.build()` receives the step index.
It builds field models per step, walks the ownership index's journeys, and assembles one `JourneyModel` per
journey with its `StepModel`s, collecting route metadata for every node in the same walk.

```mermaid
flowchart TD
  nodeIndex["ASTNodeIndex"] -->|bucket by owner| ownership["OwnershipIndex"]
  nodeIndex -->|find step nodes| stepIndex["Step index"]
  stepIndex -->|classify fields| fieldModels["FieldModelBuilder"]
  stepIndex -->|per step| stepContext["StepAnalysisContext"]
  ownership -->|per journey| journeyContext["JourneyAnalysisContext"]
  fieldModels -->|field occurrences| stepContext
  stepContext -->|concern analyzeStep()| stepModel["StepModel"]
  journeyContext -->|concern analyzeJourney()| journeyModel["JourneyModel"]
  stepModel -->|owned by journey| journeyModel
  journeyModel -->|collect entries| compilationModel["CompilationModel"]
```

- [CompilationModelBuilder.ts](CompilationModelBuilder.ts) owns the walk.
  It creates the shared services, builds the contexts, calls the concern analyzers, and returns the final
  `CompilationModel`.
- [shared/OwnershipIndex.ts](shared/OwnershipIndex.ts) buckets the registered AST by owning step and journey.
- [shared/Ancestry.ts](shared/Ancestry.ts) names the three ancestor-chain patterns.
- [shared/FieldModelBuilder.ts](shared/FieldModelBuilder.ts) classifies each step's field occurrences (registered and template) into `FieldModel`s.
- [shared/NodeLabeller.ts](shared/NodeLabeller.ts) derives script-URL identity labels from diagnostics.
- [shared/MountInfoAnalyzer.ts](shared/MountInfoAnalyzer.ts) builds `StepMountInfo` and `JourneyMountInfo`.
  It normalizes paths and merges static `data` from ancestor journeys and the current node.
- The analyzers `CompilationModelBuilder` calls live in their concerns.
  Each concern's `analysis/README.md` explains which model it builds and the rules behind it:
  [answer-cleardown](../../../concerns/answer-cleardown/analysis/README.md),
  [answer-preparation](../../../concerns/answer-preparation/analysis/README.md),
  [hooks](../../../concerns/hooks/analysis/README.md),
  [reachability](../../../concerns/reachability/analysis/README.md),
  [resolve](../../../concerns/resolve/analysis/README.md),
  [route](../../../concerns/route/analysis/README.md), and
  [validation](../../../concerns/validation/analysis/README.md).

## Boundaries

- `CompilationModelBuilder` owns model assembly.
  It should not contain the details of any concern's classification rules.
- Analyzer classes own semantic classification for one concern.
  They live in that concern's `analysis/` folder, not here, and produce that concern's model.
- The model is strictly pre-codegen: no `CodeFragment`, no `IdentifierName`, no generated identifiers.
- Reachability analysis owns compile-time navigation facts.
  Runtime navigation still evaluates the compiled navigation function with request data.
- `FieldModelBuilder` owns field-occurrence classification; `OwnershipIndex` owns field and iterate lookup.
  Phase analyzers reuse them via context instead of writing their own descendant scans.

## Quirks

- Ancestor questions go through `Ancestry`, which names the three inheritance patterns the stage uses:
  `valuesRootFirst()` for root-first merging (static data, access hooks), `nearestAncestorSetting()` for
  nearest-wins flags (the reachability disable setting), and `ancestorsOfType()` for filtered ancestor lists
  (resolve's ancestor journeys). No analyzer hand-rolls its own `parent` chain walk.
- Container journeys are present in the model with empty `steps` maps.
  Lowering skips them when emitting journey functions - a container journey has never produced a
  `CompiledJourney` - but their route metadata still compiles.

## Constraints

- Run analysis after semantic analysis.
  The analyzers assume effects, outcomes, hooks, validations etc. are all valid, and throw
  `ForgeInternalError` for impossible states only.
- Run analysis before lowering.
  The lowering phase consumes `CompilationModel`, not raw step and journey maps.
- Keep model contents typed: no `unknown` past this stage, AST nodes only as expression leaves and
  diagnostic tokens.
- Do not make lowering compilers recompute semantic facts.
  If a compiler needs a new fact, add it to the concern's model and classify it here.
- Keep concern-specific rules in the concern README and analyzer.
  This README should explain the pass shape, not duplicate every local rule.

## Editing Notes

- To add a new model fact for an existing concern, start in that concern's `contracts/<concern>Model.type.ts`,
  then classify it in the concern's analyzer.
- To add a new concern model, declare it in the concern's `contracts/`, implement `StepModelAnalyzer` or
  `JourneyModelAnalyzer` in the concern's `analysis/`, and wire it into `CompilationModelBuilder`.
- To change the spine shape, start in `contracts/models/compilationModel.type.ts` and
  `CompilationModelBuilder`.
- To change shared field, iterate, path, label, or static-data behavior, start in
  [shared/README.md](shared/README.md). Several concern analyzers depend on those definitions.

## Entry Points

- [CompilationModelBuilder.ts](CompilationModelBuilder.ts) builds the full `CompilationModel`.
- [concernAnalyzers.type.ts](concernAnalyzers.type.ts) declares the analyzer family interfaces and contexts.
- [shared/OwnershipIndex.ts](shared/OwnershipIndex.ts) answers which field blocks and iterate nodes belong to a step.
- [shared/Ancestry.ts](shared/Ancestry.ts) answers ancestor questions through the three named patterns.
- [shared/FieldModelBuilder.ts](shared/FieldModelBuilder.ts) classifies field occurrences into `FieldModel`s.
- [shared/NodeLabeller.ts](shared/NodeLabeller.ts) derives script-URL identity labels.
- [shared/MountInfoAnalyzer.ts](shared/MountInfoAnalyzer.ts) answers what runtime metadata belongs to a step or journey.
- [../../concerns/answer-cleardown/analysis/AnswerCleardownAnalyzer.ts](../../../concerns/answer-cleardown/analysis/AnswerCleardownAnalyzer.ts) answers which field codes each step in a journey can hold.
- [../../concerns/answer-preparation/analysis/AnswerPreparationAnalyzer.ts](../../../concerns/answer-preparation/analysis/AnswerPreparationAnalyzer.ts) answers what answer preparation needs to compile for a step or journey.
- [../../concerns/hooks/analysis/HookAnalyzer.ts](../../../concerns/hooks/analysis/HookAnalyzer.ts) answers which hooks apply to a step or journey and classifies them into hook models.
- [../../concerns/validation/analysis/ValidationAnalyzer.ts](../../../concerns/validation/analysis/ValidationAnalyzer.ts) answers which validation facts belong to a step.
- [../../concerns/resolve/analysis/ResolveAnalyzer.ts](../../../concerns/resolve/analysis/ResolveAnalyzer.ts) answers which ancestor journeys and iterate nodes resolve needs.
- [../../concerns/reachability/analysis/ReachabilityAnalyzer.ts](../../../concerns/reachability/analysis/ReachabilityAnalyzer.ts) answers what navigation and reachability facts belong to a journey.
- [../../concerns/reachability/analysis/ForwardNavigationAnalyzer.ts](../../../concerns/reachability/analysis/ForwardNavigationAnalyzer.ts) answers which submit outcomes can move the user forward.
- [../../concerns/reachability/analysis/RequestTimeReferenceAnalyzer.ts](../../../concerns/reachability/analysis/RequestTimeReferenceAnalyzer.ts) answers whether a predicate depends on request-time state.
- [../../concerns/route/analysis/RouteAnalyzer.ts](../../../concerns/route/analysis/RouteAnalyzer.ts) answers what route metadata a step or journey carries.
