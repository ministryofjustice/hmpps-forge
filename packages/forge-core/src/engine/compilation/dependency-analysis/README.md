# Dependency Analysis

## Scope

This document covers `packages/forge-core/src/engine/compilation/dependency-analysis`.

This code reads the registered AST and builds the `CompilationPlan` that lowering consumes.
It owns plan assembly and the AST queries more than one concern shares.

The per-concern analyzers live with their concern, under `concerns/<name>/analysis`.
`CompilationPlanBuilder` calls them; this folder holds the loop that does the calling and the shared lookups they
are built on.

This document does not cover AST creation, semantic validation, JavaScript generation, runtime
execution, or route index construction.

## Background

Dependency analysis is the compiler pass that turns a whole AST into phase-specific work lists.

The AST tells us everything that exists in the journey. But lowering - the next stage where we ask domain
questions like "is this step valid?" - needs the inputs for each question gathered into easy-to-evaluate
lists, rather than scattered across the tree. For example, a step compiler needs its own runtime metadata, fields,
hooks, validations, iterate nodes, and ancestor journeys. A journey compiler needs navigation facts and the fields
from the steps that belong to that journey. Navigation compilation needs reachability entries, cleardown fields,
forward redirects, and field inventory sources.

"Can lowering just query the AST directly?" sure, but then every phase compiler would need to rediscover the same
tree facts. It would also make ordering rules harder to see. Dependency analysis keeps those questions in one place,
so lowering receives explicit inputs instead of searching the AST repeatedly.

## Responsibilities

- Build `StepCompilationInputs` for every step in a journey.
- Build `JourneyCompilationInputs` for every journey with steps.
- Build `ReachabilityCompilationInputs` for every journey with steps.
- Build `RouteMetadataCompilationInputs` for every step and every journey.
- Group steps under their parent journey.
- Build runtime plans for steps and journeys.
- Resolve field inventories, hook inheritance, validation inputs, resolve inputs, and reachability facts.
- Keep AST querying out of lowering phase compilers where possible.

## Data Model

`CompilationPlan` is the main output.
It contains four maps:
- `stepInputs`, keyed by step node ID.
- `journeyInputs`, keyed by journey node ID.
- `reachabilityInputs`, keyed by journey node ID.
- `routeMetadataInputs`, keyed by step or journey node ID.

`StepCompilationInputs` contains:
- `core`, with the `stepNode`, the `runtimePlan` (a `StepRuntimePlan`), and the merged `staticData`.
- `answerPreparation`, with field blocks and map iterate nodes for the step.
- `hooks`, with inherited access hooks and submit hooks for the step.
- `validation`, with the step node, a `hasValidation` flag, validating field blocks, and map iterate nodes.
- `resolve`, with the step node, ancestor journeys, and all iterate nodes.

`JourneyCompilationInputs` contains the journey runtime plan, the merged `staticData`, field blocks from
the journey's steps, map iterate nodes from those steps, and journey access hooks.

`ReachabilityCompilationInputs` contains the parent `reachabilityId`, the reachability state table, the richer reachability
compilation plan, and field inventory sources for each reachable entry.

`RouteMetadataCompilationInputs` contains the node ID plus the authored `title`, `description`, and `metadata`
from that step or journey.

The analyzers share one core structure, `ASTNodeIndex`, which answers lookup questions by broad type or subtype.
Ancestry questions are answered by walking the `parent` pointer carried on every AST node.

`FieldInventoryAnalyzer` is shared by several analyzers because field and iterate lookup is needed by answer
preparation, validation, resolve, and navigation inventory.

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

`CompilationPlanBuilder.buildPlan()` groups both steps under the journey and produces plan entries:

```jsonc
{
  stepInputs: Map {
    'compile_ast:2' => {
      core: {
        stepNode: { id: 'compile_ast:2', ... },
        runtimePlan: {
          stepId: 'compile_ast:2',
          path: 'personal-details',
        },
        staticData: {},
      },
      answerPreparation: { fieldBlocks: [...], mapIterateNodes: [...] },
      hooks: { accessHooks: [...], submitHooks: [...] },
      validation: { stepNode: ..., validatingFieldBlocks: [...], mapIterateNodes: [...] },
      resolve: { stepNode: ..., ancestorJourneys: [...], allIterateNodes: [...] },
    },
  },
  journeyInputs: Map {
    'compile_ast:1' => {
      runtimePlan: { journeyId: 'compile_ast:1', path: 'travel-declaration' },
      staticData: {},
      stepFieldBlocks: [...],
      stepMapIterateNodes: [...],
      accessHooks: [...],
    },
  },
  reachabilityInputs: Map {
    'compile_ast:1' => {
      reachabilityId: 'compile_ast:1',
      stateTable: { entries: [...], ... },
      reachabilityPlan: { stateTable: ..., entries: [...], resumeAlways: false },
      fieldInventorySources: [...],
    },
  },
  routeMetadataInputs: Map {
    'compile_ast:1' => { nodeId: 'compile_ast:1', title: 'Travel declaration' },
    'compile_ast:2' => { nodeId: 'compile_ast:2', title: 'Personal details' },
    'compile_ast:3' => { nodeId: 'compile_ast:3', title: 'Summary' },
  },
}
```

The important transform is not changing AST nodes.
It is turning one tree into the exact dependency bundles each lowering compiler needs.

## Flow

Dependency analysis starts when `CompilationPlanBuilder.buildPlan()` receives a step index and a journey index.
It groups steps by parent journey, builds step inputs, builds journey inputs, builds reachability inputs,
and builds route metadata inputs for every step and journey.

```mermaid
flowchart TD
  nodeRegistry["ASTNodeIndex"] -->|find step nodes| stepIndex["Step index"]
  nodeRegistry -->|find journey nodes| journeyIndex["Journey index"]
  stepIndex -->|feed steps| planBuilder["CompilationPlanBuilder.buildPlan()"]
  journeyIndex -->|feed journeys| planBuilder
  planBuilder -->|build the plan| groupSteps["Group steps by parent journey"]
  groupSteps -->|per step| stepInputs["StepCompilationInputs"]
  groupSteps -->|per journey| reachability["ReachabilityPlanAnalyzer"]
  reachability -->|reachability facts| reachabilityInputs["ReachabilityCompilationInputs"]
  reachability -->|journey fields| journeyInputs["JourneyCompilationInputs"]
  planBuilder -->|per step and journey| routeMetadataInputs["RouteMetadataCompilationInputs"]
  stepInputs -->|collect entries| compilationPlan["CompilationPlan"]
  journeyInputs -->|collect entries| compilationPlan
  reachabilityInputs -->|collect entries| compilationPlan
  routeMetadataInputs -->|collect entries| compilationPlan
```

- [CompilationPlanBuilder.ts](CompilationPlanBuilder.ts) owns the pass orchestration.
  It creates shared analyzers, groups steps by parent journey, and returns the final `CompilationPlan`.
- [shared/RuntimePlanAnalyzer.ts](shared/RuntimePlanAnalyzer.ts) builds `StepRuntimePlan` and `JourneyRuntimePlan`.
  It normalizes paths and merges static `data` from ancestor journeys and the current node.
- [shared/FieldInventoryAnalyzer.ts](shared/FieldInventoryAnalyzer.ts) finds field blocks, validating field blocks, map iterate nodes, and all iterate nodes for a step.
  It also builds field inventory sources from reachability entries.
- The analyzers `CompilationPlanBuilder` calls live in their concerns.
  Each concern's `analysis/README.md` explains which inputs it builds and the rules behind them:
  [answer-preparation](../../concerns/answer-preparation/analysis/README.md),
  [hooks](../../concerns/hooks/analysis/README.md),
  [reachability](../../concerns/reachability/analysis/README.md),
  [resolve](../../concerns/resolve/analysis/README.md),
  [route](../../concerns/route/analysis/README.md), and
  [validation](../../concerns/validation/analysis/README.md).

## Boundaries

- `CompilationPlanBuilder` owns plan assembly.
  It should not contain the details of every phase-specific AST query.
- Analyzer classes own AST queries for one concern.
  They live in that concern's `analysis/` folder, not here.
- Reachability analysis owns compile-time navigation facts.
  Runtime navigation still evaluates the compiled navigation function with request data.
- `FieldInventoryAnalyzer` owns shared field and iterate lookup.
  Phase analyzers should reuse it instead of each writing their own descendant scans.

## Quirks

- The name is a bit broader than the code.
  This phase collects inputs for later compilers. It does not build a general graph of which AST nodes
  depend on which other AST nodes.
- Ancestry is not indexed anywhere.
  Every analyzer that needs ancestors walks the `parent` pointer on the node itself,
  so the same while-loop shape appears in several analyzers by design.
- The plan is shaped around lowering phases, not around the smallest possible data structure.
  That means some analyzers may select overlapping AST facts. The duplication keeps each lowering compiler's inputs explicit.

## Constraints

- Run dependency analysis after semantic analysis.
  The analyzers assume effects, outcomes, hooks, validations etc. are all valid.
- Run dependency analysis before lowering.
  `CodegenOrchestrator.compileAll()` consumes `CompilationPlan`, not raw step and journey maps.
- Keep analyzer outputs as AST node references and plan metadata.
  Generated code belongs in lowering, not in this pass.
- Do not make lowering compilers recompute shared AST inventories.
  That would split the same dependency rules across multiple phases.
- Keep phase-specific rules in the phase README and analyzer.
  The top-level README should explain the pass shape, not duplicate every local rule.

## Editing Notes

- To add a new lowering phase input, start in `contracts/plans/compilationPlan.type.ts`.
  Add the input shape, then add an analyzer or extend the nearest existing analyzer.
- To add another step-level input, update `StepCompilationInputs` and `CompilationPlanBuilder.buildStepInputs()`.
  Keep the same shape as the existing analyzer calls.
- To add another journey-level input, update `JourneyCompilationInputs` and `CompilationPlanBuilder.buildJourneyInputs()`.
  Check whether the data belongs to the journey itself or to the journey's steps.
- To change a phase-specific rule, start in that phase's README and analyzer.
  The local README should explain the rule and the file that owns it.
- To change shared field, iterate, path, or static-data behavior, start in [shared/README.md](shared/README.md).
  Several phase analyzers depend on those definitions.

## Entry Points

- [CompilationPlanBuilder.ts](CompilationPlanBuilder.ts) builds the full `CompilationPlan`.
- [shared/RuntimePlanAnalyzer.ts](shared/RuntimePlanAnalyzer.ts) answers what runtime metadata belongs to a step or journey.
- [shared/FieldInventoryAnalyzer.ts](shared/FieldInventoryAnalyzer.ts) answers which field blocks and iterate nodes belong to a step.
- [../../concerns/answer-preparation/analysis/AnswerPreparationInputAnalyzer.ts](../../concerns/answer-preparation/analysis/AnswerPreparationInputAnalyzer.ts) answers what answer preparation needs to compile for a step or journey.
- [../../concerns/hooks/analysis/HookInputAnalyzer.ts](../../concerns/hooks/analysis/HookInputAnalyzer.ts) answers which hooks apply to a step or journey.
- [../../concerns/validation/analysis/ValidationInputAnalyzer.ts](../../concerns/validation/analysis/ValidationInputAnalyzer.ts) answers which validation inputs belong to a step.
- [../../concerns/resolve/analysis/ResolveInputAnalyzer.ts](../../concerns/resolve/analysis/ResolveInputAnalyzer.ts) answers which ancestor journeys and iterate nodes resolve needs.
- [../../concerns/reachability/analysis/ReachabilityPlanAnalyzer.ts](../../concerns/reachability/analysis/ReachabilityPlanAnalyzer.ts) answers what navigation and reachability facts belong to a journey.
- [../../concerns/reachability/analysis/ForwardNavigationAnalyzer.ts](../../concerns/reachability/analysis/ForwardNavigationAnalyzer.ts) answers which submit outcomes can move the user forward.
- [../../concerns/reachability/analysis/RequestTimeReferenceAnalyzer.ts](../../concerns/reachability/analysis/RequestTimeReferenceAnalyzer.ts) answers whether a predicate depends on request-time state.
- [../../concerns/route/analysis/RouteMetadataInputAnalyzer.ts](../../concerns/route/analysis/RouteMetadataInputAnalyzer.ts) answers what route metadata a step or journey carries.
