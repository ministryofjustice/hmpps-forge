# Reachability Compiler

## Scope

This document covers `packages/forge-core/src/engine/compilation/lowering/phase-compilers/reachability`.

This code compiles the dynamic half of reachability: the facts function.
It emits a function that evaluates a journey's authored reachability expressions — entry predicates, forward outcomes, tie-breakers, and the resume condition — and, when request params are present, the per-step field inventory, into a `CompiledReachabilityResult`.

This document does not cover the static graph walk.
The reachability state function that turns these facts into reachable step state is assembled in `CodegenOrchestrator` over `evaluateReachabilityState` (in `function-construction/reachability`), not here.
It also does not cover runtime redirect handling.

## Inputs

`ReachabilityCompiler.compileFacts()` receives:
- a `ReachabilityCompilationPlan`, whose `entries` are the journey's steps in declaration order.
- field inventory sources, one per step.

Dependency analysis provides those inputs.

`StepFieldInventoryCompiler` receives the field inventory sources and emits field-code collection into the facts function body through `compileInto`.
Its standalone `compile()` and `generateSource()` exist only for tests and diagnostics.

## Work Returned

`compileFacts()` returns a `CompiledReachabilityFactsFunction`.
That function returns a `CompiledReachabilityResult`, not a `WorkTask`:
- `entryResults`, per-step entry predicate result, or `undefined` where a step declares no `entryWhen`.
- `outcomeValues`, per-step forward goto paths after the cascade narrows them by guard.
- `declaredOutcomeValues`, every authored static goto per step, unguarded, for the devtools graph.
- `tieBreakerPriorities`, per-step resolved priority, or `undefined`.
- `resumeActive`, the journey-level resume result.
- `fieldInventory`, present only when the request supplies params.

Every per-step array is indexed by `plan.entries` order.
The compiled state function consumes them later to walk the graph.

## Flow

The facts function emits one declaration block, then each algorithm in turn, then returns the result:

```mermaid
flowchart TD
  start["compileFacts(plan, sources)"] --> arrays["declare entryResults, outcomeValues, declaredOutcomeValues, tieBreakerPriorities"]
  arrays --> entry["compileEntryPredicates"]
  entry --> forward["compileForwardOutcomes"]
  forward --> tie["compileTieBreakers"]
  tie --> resume["compileResumeCondition sets resumeActive"]
  resume --> inventory["compileFieldInventory sets fieldInventory"]
  inventory --> ret["return CompiledReachabilityResult"]
```

## Algorithms

Each subsection describes the runtime control flow the generated code performs, not the compile-time emit loop.

### Entry predicates

A step can declare an `entryWhen` predicate that makes it an extra entry point when the predicate holds.
A step with no predicate leaves its slot `undefined`, and the graph walk treats it by its static entry status.

```mermaid
flowchart TD
  step["for each step i"] --> has{"entryWhen declared?"}
  has -->|no| skip["leave entryResults at i undefined"]
  has -->|yes| eval["entryResults at i = Boolean(predicate)"]
```

### Forward outcomes

Forward outcomes are redirect outcomes grouped by their owning submit hook.
Each group produces two things: every authored static goto is recorded in `declaredOutcomeValues` unconditionally, because the devtools graph needs the declared shape, and a cascade — guarded by the hook's `when:` when that is reachability-compilable — collects the live candidates into `outcomeValues`.

```mermaid
flowchart TD
  group["for each forward outcome group (submit hook)"] --> any{"group has redirect outcomes?"}
  any -->|no| skip["skip group"]
  any -->|yes| declared["push every static goto to declaredOutcomeValues, unguarded"]
  declared --> has{"hook has a when: node?"}
  has -->|no| exact["run cascade unguarded; the hook always fires"]
  has -->|yes| comp{"when: reachability-compilable?"}
  comp -->|yes| guarded["run cascade inside if Boolean(hookWhen)"]
  comp -->|no| over["run cascade unguarded; over-approximation"]
```

Within a group the outcomes cascade.
The first outcome that resolves a defined goto wins and closes the cascade.
An over-approximated outcome — one whose guard cannot be evaluated at compile time — contributes its path but does not close the cascade, so later outcomes still contribute.

```mermaid
flowchart TD
  init["outcomeMatched = false"] --> outcome["for each redirect outcome in order"]
  outcome --> open{"outcomeMatched === false?"}
  open -->|no| next["skip, an earlier outcome won"]
  open -->|yes| when{"outcome when: compilable and not over-approximate?"}
  when -->|yes| ifwhen["if Boolean(outcomeWhen)"]
  when -->|no| resolve["resolve goto value"]
  ifwhen --> resolve
  resolve --> defined{"gotoValue !== undefined?"}
  defined -->|no| next
  defined -->|yes| push["push String(gotoValue) to outcomeValues"]
  push --> mark{"marks matched? (not over-approximate)"}
  mark -->|yes| close["outcomeMatched = true"]
  mark -->|no| next
```

### Tie-breakers

Tie-breakers resolve a single priority per step from an ordered rule list.
The first rule that matches, or a catch-all rule with no predicate, sets the priority; a `priority === undefined` guard stops later rules from overriding the winner.

```mermaid
flowchart TD
  init["tieBreakerPriority = undefined"] --> rule["for each rule in order"]
  rule --> open{"priority === undefined?"}
  open -->|no| skip["skip, winner already chosen"]
  open -->|yes| kind{"rule has a when: predicate?"}
  kind -->|"no, catch-all"| assign["priority = rule.priority"]
  kind -->|yes| evalw{"Boolean(when)?"}
  evalw -->|true| assign
  evalw -->|false| skip
  rule --> store["after all rules: tieBreakerPriorities at i = priority"]
```

### Resume condition

Resume is a single journey-level flag.
An always-resume plan emits `true`; a plan with a resume predicate emits its boolean; everything else emits `false`.

```mermaid
flowchart TD
  q1{"plan.resumeAlways?"}
  q1 -->|yes| t["resumeActive = true"]
  q1 -->|no| q2{"resumeWhen node present?"}
  q2 -->|no| f["resumeActive = false"]
  q2 -->|yes| e["resumeActive = Boolean(resumeWhen)"]
```

### Field inventory

Field inventory runs only on step requests, which carry params.
For each step it collects registered field-block codes, static or dynamic, plus any codes from MAP iterators whose yield template contains fields, de-duplicates them, and records them with the step's cleardown patterns.

```mermaid
flowchart TD
  guard{"factsInput.params present?"}
  guard -->|no| undef["fieldInventory stays undefined"]
  guard -->|yes| init["fieldInventory = []"]
  init --> step["for each step source"]
  step --> codes["fieldCodes = []"]
  codes --> blocks["push each registered field-block code, static or dynamic"]
  blocks --> iters["for each field-bearing MAP iterator: walk yield template under iterator scope, push codes"]
  iters --> push["push step entry with unique fieldCodes and cleardownFieldCodes"]
```

## Rules

- Per-step result arrays are indexed by `plan.entries` order.
  Keep entry order stable; the state function relies on the alignment.
- Forward outcome groups preserve submit-hook grouping.
  The cascade `outcomeMatched` flag resets per group.
- Over-approximated outcomes stay possible when their guards cannot be evaluated exactly.
  They push a candidate without closing the cascade.
- `declaredOutcomeValues` is unguarded and records authored static gotos only.
  The devtools graph needs the declared shape even when a guard would suppress it at runtime.
- Field inventory is emitted only inside the `params`-present guard.
  Journey requests carry no params and skip it.
- Field inventory de-duplicates codes and includes static codes, dynamic codes, and codes from MAP iterator templates; cleardown patterns are carried through verbatim.

## Editing Notes

- To change the result shape, start in `compileReachabilityResult()` and `buildReachabilityResultExpression()`.
- To change forward outcome evaluation, start in `compileForwardOutcomes()`, `compileForwardOutcomeGroup()`, and `compileForwardOutcomeCascade()`.
- To change the facts function body or ordering, start in `buildFactsSource()`.
- To change field inventory behavior, start in `StepFieldInventoryCompiler`.
- To change how facts become reachable state, edit `function-construction/reachability`, not this folder.
- To inspect generated source, use `generateFactsSource()` in the tests.

## Entry Points

- [ReachabilityCompiler.ts](ReachabilityCompiler.ts) emits the reachability facts function source and compiles it.
- [StepFieldInventoryCompiler.ts](StepFieldInventoryCompiler.ts) emits the per-step field inventory the facts function fills when params are present.
