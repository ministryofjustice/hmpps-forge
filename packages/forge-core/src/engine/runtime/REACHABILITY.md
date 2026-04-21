# Reachability, Resume & Redirect Resolution

This document defines the conceptual model and decision rules governing how users navigate through Forge journeys at runtime.

The central idea: the reachability system builds a directed graph of steps, then **tiebreakers linearise that graph into a single ordered path**. The frontier and backlinks are positions on that line. Root landing and redirect resolution use the linearised path as an input but also draw on other signals (entry point tiebreakers, resume state).

---

## Core Concepts

### Entry Points

Entry points are steps that bypass reachability checks. They act as doors into a journey that the user can always access directly, without needing to have traversed a valid path to arrive there.

Entry points come in two forms:

- **Unconditional** (`entryWhen: true`) — always a valid door. The step is reachable regardless of journey state.
- **Conditional** (`entryWhen: <condition>`) — a door that only opens when the condition evaluates to true. Allows access to pages that aren't active under all circumstances.

A journey may have multiple entry points. They are not necessarily "the first step" — they are access guarantees.

### Validity

A step's validity is determined by running its validation rules against the current session state. A step is valid when all its required fields have acceptable values and any domain validations pass.

Steps with no validation requirements (no fields, no `validWhen` rules) are **trivially valid** — they are always valid because there is nothing to validate. This distinction matters for progress detection.

### Tiebreakers

Tiebreakers resolve ambiguity. Whenever the reachability graph presents multiple candidates for a single decision — multiple predecessors, multiple forward branches, multiple entry points — tiebreakers select one winner by numeric priority.

Tiebreakers are a graph disambiguation tool. They do not override user intent or force routing decisions on their own. Their purpose is to **collapse a branching graph into a single linear path**.

---

## The Reachability Graph

Reachability answers the question: **can this user be on this step right now?**

It is determined by a breadth-first walk starting from all active entry points. The walk follows forward edges (derived from a step's `next`/redirect declarations in submission handlers) and propagates through valid steps to discover which downstream steps are reachable.

### BFS Walk Rules

- Entry points are always reachable (they seed the walk).
- A step's forward edges are always resolved (we know where it *would* link to), regardless of validity.
- A valid step propagates: its successors become reachable and are added to the walk queue.
- An invalid step does NOT propagate: its successors remain unreachable unless reached via another path.
- The walk records predecessor relationships (which steps led to which), building the directed graph.

A step is reachable if it is an entry point OR the walk reached it via forward edges from a valid ancestor.

### Inputs

- **Steps** — all steps in the journey, initialised with entry point seeds.
- **Forward outcome IDs** — compiled from each step's `next`/redirect declarations in submission handlers.
- **Validation state** — determined per-step by running validation rules against session data.

### Algorithm

1. **Seed entry points.** Mark all unconditional entry points as reachable. Evaluate conditional entry conditions and mark those that pass as reachable.

2. **Initialise the queue** with all reachable steps.

3. **Process each step in the queue:**
   - Evaluate its validity (run validation rules against session state).
   - Resolve its forward edges (evaluate the forward outcome thunks to determine link targets).
   - If the step is valid: mark each forward target as reachable, record predecessor relationships, and add unvisited targets to the queue.
   - If the step is invalid: forward edges are resolved (we know where they point) but successors are NOT marked reachable and NOT added to the queue.

4. **Evaluate tiebreakers** for all reachable steps.

### Note on Current Step Evaluation

When resume is configured for the journey, the current step (the one the user is requesting) IS evaluated for validity and forward edges like any other step. This ensures the full graph is available for path linearisation.

When resume is NOT configured and the current step is already reachable, the walk short-circuits (no need to compute the full graph for a simple reachability check).

---

## The Linearised Path

The reachability graph may contain branches (a step with multiple forward edges) and convergences (a step with multiple predecessors). A **linear flow through a subset of the journey's steps** can be derived based on the reachability, tiebreakers, and current state of progress.

At every branching point, the tiebreaker selects one winner. The result is a single route through the journey:

```
[step1, step2, step3, step4, step5]
```

This derived path is not a static property of the journey — it changes as reachability conditions shift, tiebreaker conditions evaluate differently, and the user makes progress. It is always a subset of the journey's steps.

The linearised path is the foundation for frontier and backlink computation — both are positions on this line, not independent graph traversals. Root landing and redirect resolution also use the path but combine it with other inputs (see below).

### Root Landing

When a user arrives at the journey root (not a specific step), the system needs to pick where to send them.

Resume takes precedence over the default landing. If the resume condition is met and progress exists, the user goes to the frontier — even when arriving at the journey root. The tiebreaker-winning entry point is the fallback when resume does not apply.

```
User hits journey base URL
        |
        v
Is resume active + progress?
        |
        +-- Yes --> Redirect to frontier
        |
        v No
Redirect to tiebreaker-winning entry point
```

The default landing target (tiebreaker-winning entry point) might be the start of the linearised path, or it might be a separate page like an overview. The journey author controls this via tiebreaker priority.

### Backlinks

The backlink for a step is the **previous step on the linearised path**.

```
[step1, step2, step3, step4, step5]
          ↑      ↑
     backlink   current page
```

When a step has multiple predecessors in the graph (reached via more than one path), the tiebreaker determines which predecessor sits on the linearised path. That predecessor is the backlink.

Backlinks always follow the canonical linearised path. There is no multi-request state tracking to determine which entry point the user originally came through. If the user entered via a different door and the canonical backlink doesn't match their actual navigation history, the author can use the `backlink` override feature on specific steps to customise this behaviour.

### The Frontier

The frontier is the **first invalid non-entry step on the linearised path**. It represents where the user's progress stalled — the first point where they need to take action.

```
[step1, step2, step3, step4, step5]
   ✓      ✓      ✓      ✗      ✗
                         ↑
                      frontier
```

Entry points are never the frontier. The frontier only considers non-entry steps, because entry points are access doors, not progress milestones.

When no invalid non-entry step exists on the linearised path, the journey is effectively complete and there is no frontier.

### Navigating Backward

A user can navigate backward along the linearised path (e.g., to change an earlier answer). The backlink, frontier, and current position are all independent markers on the same line:

```
[step1, step2, step3, step4, step5]
          ↑      ↑             ↑
     backlink  current       frontier
               page
```

The user is on step3. The backlink points at step2. The frontier is step5 (the first invalid step). If resume fires, the user is redirected to step5.

---

## Progress

Progress determines whether resume has anything to act on. If the user has not made progress in the journey, there is nothing to resume from.

**Progress exists when:** any reachable step with validation requirements is valid.

This means the user has actually submitted data for at least one form step. The distinction:

- A step that is trivially valid (no fields to validate) does not constitute progress — it has nothing to complete.
- An entry point with required fields that has been filled in DOES count as progress — filling in a form is work, regardless of whether the step is an entry point.

| Scenario | Progress? | Why |
|----------|-----------|-----|
| Fresh journey, no data entered anywhere | No | No step with validation is valid |
| Entry point (has fields) filled in, next step unfilled | Yes | Entry has validation and is valid |
| Entry point (no fields) leads to form page (unfilled) | No | Only trivially-valid steps exist |
| Entry point (no fields) leads to form page (filled) | Yes | Form has validation and is valid |

---

## Resume

Resume is a system that redirects users to their frontier — the point in a journey where they should pick up, based on their progress. It is designed for partially-completed journeys: the user started work, left, and has now returned.

### Resume Condition

Resume is triggered by a per-request condition defined via `resumeWhen` in the journey configuration. This condition is evaluated on every request to a step within the journey.

In real usage, the condition is typically selective:

```typescript
reachability: {
  resumeWhen: or(
    Query('resume').match(Condition.Equals('true')),
    Request.Path().match(Condition.String.EndsWith('/my-journey'))
  )
}
```

This means resume does not fire on every page load — it fires when the user enters the journey through a specific mechanism (a query parameter, a matching path, etc.).

When `resumeWhen: true` is used, resume fires on every request. This is valid but aggressive — it means all navigation within the journey is overridden by progress-based routing.

### Resume Decision Flow

```
Request arrives at a step
        |
        v
Evaluate resumeWhen condition
        |
        +-- false --> Resume does not apply. Use normal reachability rules.
        |
        v true
Check if progress exists
(any reachable step with validation that is valid?)
        |
        +-- No progress --> No-op. User stays where they are.
        |
        v Progress exists
Compute the frontier
(first invalid non-entry step on the linearised path)
        |
        +-- No frontier (all valid) --> No-op. Journey is complete.
        |
        v Frontier exists
Is the frontier the current step?
        |
        +-- Yes --> No redirect needed. User is already where they should be.
        |
        v No
Redirect to the frontier.
```

### Key Principle

When resume fires with progress, it **always** redirects to the frontier. It does not matter if the user explicitly navigated to an entry point, or if they are on a completed step. The resume condition being true means "take me where I need to be," and the system honours that.

This is by design: the resume condition is expected to be selective (triggered by specific entry mechanisms), not a blanket rule. If the journey author uses `resumeWhen: true`, they are accepting that all navigation within the journey will be overridden by progress-based routing.

---

## Redirect Resolution

The redirect resolver is the final decision layer. It combines reachability, the linearised path, and resume to determine whether the current request should be redirected, and where.

### Decision Flow

```
Request arrives at a step
        |
        v
Is resume active? (resumeWhen evaluated to true)
        |
        +-- Yes --> Apply resume logic (see Resume Decision Flow above).
        |           If resume produces a redirect target, redirect there.
        |           If resume is a no-op, continue below.
        |
        v No (or resume was a no-op)
Is the current step reachable?
        |
        +-- Yes --> No redirect. Render the step.
        |
        v No
Redirect to the tiebreaker-winning entry point.
```

### Non-Resume Fallback

When resume is not active (or is a no-op) and the user is on an unreachable step, the system falls back to entry point selection. The tiebreaker-winning entry point is chosen as the redirect target. This covers scenarios like:

- User bookmarked a step that is no longer reachable (conditions changed).
- User manually typed a URL for a step deep in the journey without having traversed the path.
- A conditional entry point deactivated, making previously-accessible steps unreachable.

---

## Putting It All Together

```
                    The Reachability Graph
                    (built by BFS walk)
                            |
                            v
                    Tiebreakers linearise
                    the graph into a path
                            |
                            v
            [step1, step2, step3, step4, step5]
               |      |      |      |      |
               v      v      v      v      v
             valid  valid  valid  invalid invalid
                                    |
                    +---------------+
                    |
                    v
    Frontier = step4 (first invalid non-entry step)
    Backlink from step3 = step2 (previous on path)

    Resume active + progress?
        Yes --> redirect to step4
        No  --> normal reachability rules
```

---

## Truth Tables

### Resume Outcome

What does the resume system produce for a given request?

| Resume condition | Progress exists | Frontier exists | Frontier = current step | Result |
|------------------|-----------------|-----------------|-------------------------|--------|
| false | - | - | - | No-op |
| true | false | - | - | No-op |
| true | true | false | - | No-op (journey complete) |
| true | true | true | true | No-op (already there) |
| true | true | true | false | Redirect to frontier |

### Redirect Resolution (Step Requests)

When a user requests a specific step, what happens?

| Resume outcome | Step reachable | Result |
|----------------|----------------|--------|
| Redirect to frontier | - | Redirect to frontier |
| No-op | true | Render step |
| No-op | false | Redirect to tiebreaker-winning entry point |

### Root Landing (Journey Base URL)

When a user hits the journey root, not a specific step.

| Resume condition | Progress exists | Frontier exists | Result |
|------------------|-----------------|-----------------|--------|
| false | - | - | Redirect to tiebreaker-winning entry point |
| true | false | - | Redirect to tiebreaker-winning entry point |
| true | true | false | Redirect to tiebreaker-winning entry point |
| true | true | true | Redirect to frontier |
