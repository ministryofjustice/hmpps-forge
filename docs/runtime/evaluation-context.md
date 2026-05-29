# Evaluation context

## Purpose

The evaluation context is the per-request state used while Forge evaluates a
journey.

It holds the request and response objects from the framework adapter, plus the
mutable state that compiled functions share during the request. This includes
prepared data, prepared answers, validation state, and reachability state.

The context is not durable storage. It exists for one request and is rebuilt for
the next request.

## Why Forge uses a request context

Forge runtime is stateless. It does not keep journey progress or answer state
inside the framework runtime between requests.

Instead, each request gets a new evaluation context. Application code,
middleware, effects, and framework adapters can load data into the request or
session before Forge evaluates the journey. Forge then reads those values
through the context.

This keeps request evaluation deterministic for the inputs it receives. Given
the same compiled journey, request data, session data, answers, and registered
functions, Forge should make the same access, validation, navigation, and
rendering decisions.

The context also gives compiled functions a shared place to record work done
during the request. Answer preparation can write answers. Validation can write
validation state. Reachability can write reachable and unreachable step state.
Rendering can then read the same request-local state.

## Pipeline position

The evaluation context is created near the start of request handling.

For step requests and journey-root requests, the controller first converts the
framework request and response into Forge request objects. `ContextPreparer`
then creates a `RuntimeEvaluationContext` and merges static journey data into
it.

This happens before access hooks run. Access hooks, effects, validation,
reachability, and rendering all use the same request context after that point.

## Inputs and outputs

The main inputs are:

- the Forge request object
- the Forge response object
- the runtime plan for the current route
- the shared compilation structures
- the function registry for compiled function calls

The main output is a prepared `RuntimeEvaluationContext`.

During request handling, Forge also builds smaller compiled function contexts
from the runtime context. These are passed into generated functions instead of
passing the full runtime context.

## Key concepts

### `RuntimeEvaluationContext`

`RuntimeEvaluationContext` is the top-level context object for a request.

It contains:

- the Forge request object
- the Forge response object
- request-local global state

The global state starts with empty `data` and `answers` objects. Runtime then
adds validation and reachability state when those parts of the lifecycle run.

### Global state

Global state is shared by the compiled functions for one request.

It contains:

- `data`, for static and loaded data available to the journey
- `answers`, for answer history prepared during the request
- `validation`, for the latest validation result for the current step
- `reachability`, for reachable and unreachable steps

This state is mutable by design. The runtime lifecycle is sequential, and later
steps need to observe earlier work. For example, validation and rendering need
to see the answers produced by answer preparation.

### Static data preparation

`ContextPreparer` merges static data into `context.global.data`.

It uses the access ancestor IDs from the runtime plan to find the journey and
step ancestors for the current route. Static data is merged from outer ancestors
to inner ancestors, so inner data can override outer data. Static data is defined 
through the `data` property on a journey/step definition.

This happens before access hooks run so hooks and effects can read the same
prepared data as the rest of the request lifecycle.

### Answer history

Answers are stored as answer histories, not just raw values.

An answer history contains the current value and the mutations that produced
it. Mutations can come from sources such as submitted POST data, processed
values, defaults, dependency checks, access hooks, or submit hooks.

This lets the request lifecycle preserve both the current answer value and the
sequence of changes that produced it. 

    Note:
    This mainly exists to support effects that would like to build a delta of 
    answers, so they can determine what has changed since the loading of the 
    answers, and what a POST might have changed. It also serves as a bit of a 
    debugging interface, as it can clarify where/why an answer ended up with a 
    certain value when evaluated.

### Compiled function contexts

Generated functions do not receive the full `RuntimeEvaluationContext`.

Instead, Forge creates smaller context objects for the generated function being
called. The base compiled context contains:

- `answers`
- `data`
- `session`
- `params`
- `query`
- a request snapshot
- the function registry

Answer preparation and rendering contexts also include POST data. Hook
lifecycle contexts include validation state, logger access, a validation
callback, and an effect context.

Keeping these shapes small makes the generated-function boundary explicit. It
also stops controller-only objects from becoming part of the code generation
contract.

### Effect context

Hook effects need more access than ordinary generated expressions.

The hook lifecycle context includes an effect context with the request-local
global state, request, and response. This is the runtime escape hatch for
effects that need to change request state or interact with the framework
response.

Effects are still scoped to hooks. They should not become a general way for
ordinary expressions to mutate runtime state.

    Note:
    This should likely be revised to a smaller interface in future.

## What can fail

Evaluation context creation should fail if Forge cannot prepare the request
state needed by the runtime lifecycle.

Important failure cases include:

- an access ancestor ID does not resolve to a registered journey or step
- a compiled function expects context state that has not been prepared
- request data has a shape that a registered function cannot handle
- an effect mutates request-local state in a way later phases cannot use

The main rule to preserve is that request-local state should flow through the
evaluation context. Runtime code should not add hidden state elsewhere in the
framework runtime.

## Connection to other runtime docs

The request lifecycle doc explains when Forge creates and uses the evaluation
context.

The navigation and reachability doc explains how reachability state is projected
into the context.

The rendering doc explains how answers, data, validation, and navigation state
are read from the context to build the final render context.
