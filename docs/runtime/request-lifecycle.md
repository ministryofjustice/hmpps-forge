# Request lifecycle

## Purpose

Runtime uses the compiled plans and functions to evaluate each request.

The earlier phases decide what the journey is and how it should be evaluated.
Runtime applies those decisions to a specific request snapshot: session, answers,
data, route params, and query string.

This phase does not rebuild the journey structure. It prepares context, runs
compiled functions, evaluates navigation, and returns a `ForgeOutcome`
(render, navigate, or error) for the adapter to dispatch.

## Why runtime is driven by plans/compiled-functions

Runtime is the request path. It should do the minimum work needed for the
current request.

Forge keeps runtime plan-driven/compiled-function-driven so evaluation 
does not need to inspect the original DSL. The evaluator already knows which 
step or journey-root plan a given node owns. It can call the compiled functions 
attached to that plan, then use runtime code for policy decisions such 
as redirect handling, reachability graph walking, and render-context assembly.

This keeps the split between compilation and runtime clear:

- compilation decides which work exists
- runtime decides what happens for this request

That split also keeps Forge stateless. The framework does not keep durable
journey state between requests. Each request is evaluated from the compiled
journey, the current request context, and the data loaded into that context.

## Pipeline position

Runtime runs after validation, intermediate representation, and compilation.
It is the point where the compiled journey meets an incoming request snapshot.

It starts when the adapter matches an incoming request to a route from
`forge.getTopology()`, builds a `RequestSnapshot`, and calls
`forge.evaluate(snapshot)`. The engine resolves the matching `NodeExecutor` by
node ID and runs the appropriate pipeline.

The executors do not compile the journey. They receive the plans and compiled
functions produced by phase 3 and apply them to the current snapshot.

Runtime has three evaluation entry points:

- step GET evaluations, which produce a render outcome
- step POST evaluations, which process submitted data for a step
- journey-root GET evaluations, which produce a navigate outcome

The sections below describe those flows.

## GET step evaluations

A GET evaluation renders a step.

Forge wraps the `RequestSnapshot` in a `SnapshotStepRequest` and a
`RecordingStepResponse`, then creates a `RuntimeEvaluationContext` for the
request and merges static journey data into that context.

Forge runs the compiled access lifecycle before doing any step evaluation. If an
access hook returns a redirect, the outcome is a navigation. If it returns an
error, the outcome is an error.

If access passes, Forge prepares answers. On a GET request this means resolving
defaults, dependent values, and any compiled answer preparation needed before
navigation or rendering can read answers.

Forge then evaluates reachability and navigation. If the current step should
not be served, the outcome is a navigation to the correct route. This can happen
when resume navigation is active, or when the current step is no longer
reachable.

After navigation, Forge may run entry validation. Entry validation is used when
a step is configured to show validation failures before submission.

Finally, Forge calls the compiled render function, builds the render context,
and returns a render outcome containing the context, the component registry,
and any recorded effects.

## POST step evaluations

A POST evaluation processes submitted data for a step.

Forge begins the same way as a GET evaluation. It wraps the snapshot, prepares
the runtime context, and runs the compiled access lifecycle.

If access passes, Forge prepares answers from the submitted request body. Answer
preparation applies field parsing, formatting, defaults, dependency checks, and
compiled answer mutations before submit hooks run.

Forge then evaluates reachability and navigation. If the posted step is not
reachable, the outcome is a navigation to the correct route before submit hooks
run.

Submit hooks run after answers and navigation are prepared. Hooks can validate,
run effects, return errors, or redirect. Validation called from submit hooks
uses the compiled validation function for the step.

If a submit hook redirects, the outcome is a navigation. If it returns an error,
the outcome is an error.

If the request is not redirected, Forge renders the current step. Validation
failures from the submit lifecycle are attached to the render context in the
render outcome.

## Inputs and outputs

The main inputs are:

- the compiled step or journey plan
- compiled functions attached to that plan
- the shared compilation structures
- a `RequestSnapshot` from the adapter
- the function and component registries for the journey

The main outputs (as a `ForgeOutcome`) are:

- a navigation (redirect URL + effects)
- an error (error code + message + effects)
- a render (render context + component registry + effects)

Runtime also mutates the per-request evaluation context. This mutation is local
to the request. It records prepared answers, validation state, and reachability
state so later phases of the same request can use them.

## Key concepts

### `ForgeEvaluator`

`ForgeEvaluator` builds per-node evaluation pipelines from compiled journeys.

It stores `NodeExecutor` records keyed by node ID, each containing the
orchestrators (GET and/or POST), the route path, journey code, static data, and
the scoped component registry. It also builds the `ForgeTopology` (routes as
data) that adapters consume to register routes.

The evaluator does not own a router or touch framework objects. Its job is to
resolve the correct executor for a snapshot and run the pipeline.

### `RequestOrchestrator`

`RequestOrchestrator` runs a sequence of phases in order for each request.

Each phase returns `continue`, `halt-redirect`, or `halt-error`. If all phases
continue, the orchestrator falls through to a terminal (render or redirect).

`ForgeEvaluator` creates a GET orchestrator and a POST orchestrator for each
step node, each wired with the appropriate phases and terminal. Journey-root
nodes use a simpler orchestrator with just access and answer-preparation phases,
plus a redirect terminal.

Missing compiled functions fail fast. There is no interpreted fallback.

### `RuntimeEvaluationContext`

`RuntimeEvaluationContext` is the mutable state for one request.

It holds the shared compilation structures, journey dependencies, request,
response, and global request state.

The global state contains:

- prepared data
- prepared answers
- validation state
- reachability state

This context is not durable storage. It exists only while Forge evaluates the
current request.

### Compiled function contexts

Compiled functions do not receive the full `RuntimeEvaluationContext`.

Instead, Forge builds smaller context objects for each compiled function shape.
Those contexts expose the values generated code is allowed to read, such as
answers, data, session, params, query, request snapshots, post data, and the
function registry.

This keeps the generated-function boundary explicit. It also prevents
orchestrator-only objects from becoming part of the code-generation contract.

### Navigation and reachability

Reachability uses both compiled functions and TypeScript runtime policy.

The compiled reachability function evaluates dynamic values such as entry
predicates, forward outcomes, tie-breakers, and resume conditions. The runtime
reachability graph builder then uses those values to decide which steps are
reachable.

This keeps expression evaluation compiled, while navigation policy remains in
ordinary TypeScript code that is easier to inspect and test.

### Rendering

Rendering starts with the compiled render function for the current step.

That function evaluates step metadata, ancestor metadata, and renderable blocks.
`RenderContextFactory` then attaches validation failures, builds navigation
metadata, resolves active navigation state, and produces the final render
context.

The engine returns the render context inside the outcome. The adapter decides
how that context becomes an HTTP response.

## What can fail

Runtime should fail when a request cannot be evaluated from the compiled plans
and current context.

Important failure cases include:

- access hooks return an error outcome
- submit hooks return an error outcome
- a required compiled function is missing
- reachability cannot resolve a route-template path for a step
- journey-root navigation cannot find a reachable step
- a generated function throws while evaluating request data

Generated-function failures are wrapped with runtime diagnostics when Forge has
metadata for the failing node or function.

The main rule to preserve is that request handling stays context-driven.
Runtime should use the compiled plans, compiled functions, and current request
context rather than reading durable state from the framework runtime.

## Connection to the next phase

Runtime is the final phase of the journey pipeline.

After runtime finishes a request, Forge has returned either a render outcome, a
navigate outcome, or an error outcome for the adapter to dispatch.

The next request starts again from the compiled journey and a new request
context. Any persistence, external state, or cross-request data must be loaded
back into context by application code, framework integration, middleware, or
effects.
