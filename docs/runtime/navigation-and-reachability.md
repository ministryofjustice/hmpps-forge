# Navigation and reachability

## Purpose

Navigation and reachability decide which steps can be served for the current
request.

Forge does not treat a journey as a simple linear list of pages. Entry
conditions, redirects, validation state, resume behaviour, and cleared-down
answers can all affect the path a request should take.

This work is now plan-driven. Compilation builds a navigation plan and attaches
a compiled navigation function to it. Runtime controllers call that function
with the current request context, then use the result to render, redirect, or
resume progress.

## Why navigation is compiled

Navigation needs both static journey topology and request-time values.

The topology is known during compilation:

- which steps belong to the same journey branch
- which steps are entry points
- which steps have validation
- which steps can produce forward outcomes
- which fields belong to each step
- which cleardown rules apply to each step

The request-time values are evaluated when a request arrives:

- entry predicates
- redirect target values
- tie-breaker priorities
- resume conditions
- validation results used during reachability traversal

Forge compiles this into a single navigation evaluator for the plan. That
evaluator can calculate the dynamic values, walk the plan, resolve the canonical
path, apply resume behaviour, and project reachability state for the request.

This keeps navigation off the interpreted path. Runtime does not rebuild the
journey structure or walk the original definition.

## Pipeline position

Navigation plans are built during compilation.

Each step and journey root receives a plan reference that includes the compiled
navigation function for its branch.

At runtime, navigation runs after access hooks and answer preparation.

This order matters. Access hooks can stop the request before navigation runs.
Answer preparation must run before navigation because reachability expressions
and validation checks may read answers.

For GET requests, navigation can redirect away from the current step before
entry validation and rendering.

For POST requests, navigation can redirect away from an unreachable posted step
before submit hooks run.

For journey-root requests, navigation chooses the step to redirect into.

## Inputs and outputs

The main inputs are:

- the navigation runtime plan for the journey branch
- the compiled navigation function attached to that plan
- the current step ID, if the request is for a step
- the route-template catalog for the journey branch
- the compiled evaluation context
- request params, when reachability state should be projected

The main output is a `NavigationEvaluation`.

That evaluation contains:

- the state for each step in the branch
- the default entry route
- the canonical path
- the current frontier route
- whether progress exists
- whether resume is active
- whether the current request should redirect for resume

Step requests can also receive projected reachability state. When the compiled
navigation function returns that state, the controller writes it back to
`context.global.reachability` for later runtime work.

## Key concepts

### Navigation runtime plan

The navigation runtime plan is built during compilation.

It stores the static navigation shape for a journey branch. The plan contains
step entries, resume configuration, reachability settings, compiled validation
functions, and the compiled navigation function.

The plan is shared by the direct steps in the same journey branch. This keeps
the branch topology consistent for step requests and journey-root requests.

### Compiled navigation function

The compiled navigation function is the request-time evaluator for a navigation
plan.

It evaluates the dynamic reachability values for the current request, including
entry predicates, forward outcomes, tie-breaker priorities, and resume state.

It then delegates to the generated-navigation helpers that build step state,
walk reachability, resolve paths, apply resume behaviour, and project
reachability state when the caller provides request params.

The important boundary is that controllers do not assemble navigation
themselves. They call the compiled function attached to the plan.

### Dynamic reachability values

Dynamic reachability values are returned in arrays aligned to the plan entries.

These values include:

- entry predicate results
- forward outcome values
- tie-breaker priorities
- resume state

Keeping values aligned by step position lets the generated navigation evaluator
combine request-time results with the static plan without re-walking the
definition.

### Reachability graph

Reachability is evaluated from the plan and dynamic values.

The graph starts with a state object for each step in the plan. Entry points are
marked as reachable from explicit entry configuration or from evaluated entry
predicates.

The graph then walks forward from reachable entries. Redirect outcomes become
edges when they resolve to known step routes in the current route-template
catalog.

If a step has validation, the evaluator can call that step's compiled
validation function while walking. Invalid steps can still be reachable, but
Forge does not continue through their forward outcomes.

### Disabled reachability checks

Reachability checks can be disabled for a journey branch.

When this is active, navigation marks every step as reachable. It can still
apply compiled tie-breakers so path and entry selection remain stable.

### Forward outcomes

Forward outcomes come from redirect outcomes in submit hooks.

The compiled navigation function evaluates the authored `goto` values. The
navigation plan then resolves those values against the route-template catalog
for the journey branch.

Only targets that resolve to known step routes become navigation edges.
External URLs or unknown internal paths are not treated as graph edges.

### Tie-breakers

Tie-breakers decide between multiple possible active entries, predecessors, or
successors.

The compiled navigation function evaluates tie-breaker priorities. Navigation
then chooses the highest priority candidate. If no candidate has a priority,
declaration order is used.

### Canonical path

The canonical path is the path through the reachable graph for the current
request.

It can be based on:

- the default entry path
- the path through the current step
- the resume path

The frontier route is the step Forge should redirect to when resume is active
and progress exists.

### Resume behaviour

Resume is based on the compiled resume state and the canonical path.

If resume is active and progress exists, a journey-root request redirects to
the frontier route. A step request also redirects when the current step is not
the frontier route.

If resume is not active, navigation uses the current step path when possible,
or falls back to the default entry path.

### Reachability projection

For step requests, compiled navigation can project reachability state into a
shape stored on `context.global.reachability`.

The projected state contains reachable and unreachable steps. For each step,
Forge can include the resolved path, step code, field codes, cleardown field
codes, and backlink path.

This lets later runtime work read reachability state without understanding the
navigation graph or the compilation plan.

### Fields to clear

Fields to clear are derived from projected reachability state and current
answers.

Unreachable steps can contribute answer keys that should be cleared by effect
code. This can include explicit field codes and codes that match configured
cleardown patterns.

This prevents answers from unreachable parts of the journey from continuing to
affect later evaluation.

## What can fail

Navigation should fail when Forge cannot evaluate a reliable path from the
compiled plan and current request context.

Important failure cases include:

- the navigation plan has no compiled navigation function
- a step in the plan has no route-template path
- a step that needs validation has no compiled validation function
- a journey-root request has no reachable step to redirect into
- a registered function used by navigation or validation throws

Some unresolved redirect targets are ignored rather than treated as graph edges.
This prevents external or unknown URLs from becoming internal navigation edges.

The rule to preserve is that navigation should stay plan-driven. Runtime
controllers should call the compiled navigation function and act on its result,
not rebuild navigation from the original definition.

## Connection to other runtime docs

The request lifecycle doc explains when controllers call navigation.

The evaluation context doc explains where navigation reads request state from
and where projected reachability state is stored.

The render context doc explains how canonical paths and backlinks affect the
final render context.
