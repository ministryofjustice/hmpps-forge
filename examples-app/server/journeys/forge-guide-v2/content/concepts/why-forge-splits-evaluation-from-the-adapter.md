---
title: Why Forge splits evaluation from the adapter
slug: why-forge-splits-evaluation-from-the-adapter
section: concepts
path: concepts/why-forge-splits-evaluation-from-the-adapter
nav: Inside the engine
order: 23
description:
  Why Forge keeps journey evaluation separate from the web framework, and how the
  boundary contracts let the engine stay portable, testable, and framework-independent
teaches:
  [
    adapter-boundary,
    request-snapshot,
    forge-outcome,
    response-bindings,
    forge-renderer,
    forge-topology,
    testability,
  ]
prerequisites:
  [
    how-forge-runs-a-request,
    returning-a-page-redirect-or-error,
    packaging-journeys-into-an-app,
  ]
related:
  concept:
    [
      how-blocks-resolution-and-rendering-connect,
      how-forge-compiles-definitions-and-why,
      returning-a-page-redirect-or-error,
    ]
---

# Why Forge splits evaluation from the adapter

Forge evaluates journeys. It does not mount routes, read HTTP requests, or write HTTP
responses. The web framework handles those concerns through an adapter.

That boundary is deliberate. It gives the engine framework independence, testability, and
a clear ownership model.

## One call, one boundary

The adapter drives every request through a single entry point: `forge.execute()`.

```ts
const outcome = await forge.execute({
  snapshot,
  responseBindings,
  renderer,
});
```

The adapter builds the inputs. Forge evaluates the journey node and returns an outcome.
The adapter then dispatches the outcome to the framework response.

There are no callbacks from the engine into the adapter during evaluation. The two optional
exceptions are the `ResponseBindings` sink and the `ForgeRenderer`, both supplied by the
adapter itself. Forge does not ask the adapter to resolve routes, build snapshots, or commit
responses. The direction is always: the adapter calls Forge, Forge returns a result.

## What lives on each side

Forge owns journey evaluation. The adapter owns framework concerns.

**Forge owns:**

- journey decisions (validation, reachability, hooks, answer preparation, cleardown)
- expression evaluation and compiled function execution
- block resolution (turning block properties into evaluated data)
- function registry lookup (finding the component entry for each block variant)
- outcome selection (which phases run, whether the result is render, redirect, or error)

**The adapter owns:**

- route mounting (reading the topology and wiring routes into the framework router)
- request translation (turning the native HTTP request into a `RequestSnapshot`)
- response writing (turning a `ForgeOutcome` into an HTTP response)
- the rendering integration (template engine dependencies, nested-output wrapping, default page assembly)
- session, cookie, and header management
- error forwarding to the framework error model

Forge never imports Express, Nunjucks, or any framework library. The adapter imports both.

## The boundary contracts

Five typed contracts keep the boundary clean.

**`RequestSnapshot`** is the framework-neutral input to evaluation. The adapter builds it
from the native request. It contains everything the engine needs: the node ID, HTTP method,
location, route params, query, post body, headers, cookies, session, and adapter-managed
state. The engine never sees the native framework request object.

**`ForgeOutcome`** is the result of evaluation. It has three shapes: render (the page is
ready), navigate (redirect to a URL), and error (the request cannot continue). The adapter
inspects the shape and dispatches the framework response.

**`ResponseBindings`** is the side channel for writes during evaluation. Hook effects can
set headers and cookies through it. The adapter decides what those writes do. The Express
adapter writes straight to the response. The test client captures them for assertions.

**`ForgeRenderer`** is the optional rendering strategy supplied by the adapter. It wraps
nested component output and provides default page assembly. An authored `renderer()`
replaces that assembly for the steps that select it. Without a `ForgeRenderer`, the
pipeline stops after resolve, and the outcome carries the render context without assembled
output.

**`ForgeTopology`** is the route table. Forge exposes it after packages are registered.
Each entry carries a node ID, a path template, a kind, and the allowed HTTP methods. The
adapter mounts one route per entry.

:::deep-dive
---
title: How a request flows through the boundary
description: A step-by-step trace of one request from the framework into Forge and back.
summary: Show the full request flow
---

1. A user submits a form. The framework router matches the request to a Forge route.
2. The adapter builds a `RequestSnapshot` from the native request (params, query, post
   body, session, headers, cookies).
3. The adapter builds a `ResponseBindings` sink (or uses the no-op default).
4. The adapter calls `forge.execute({ snapshot, responseBindings, renderer })`.
5. Forge looks up the compiled node by the snapshot's `nodeId`.
6. Forge runs the request pipeline: context preparation, access, answer preparation,
   validation, reachability, cleardown, submit hooks, route tree, resolve, and render.
7. During evaluation, hook effects can write headers and cookies through `ResponseBindings`.
8. Forge returns a `ForgeOutcome`: render, navigate, or error.
9. The adapter dispatches the outcome. For the Express adapter: render sends HTML, navigate
   calls `res.redirect`, and error forwards to Express error handling.

:::

## Why the split exists

**Framework independence.** `forge-core` has no dependency on Express, Nunjucks, GOV.UK
Frontend, or any other framework library. The adapter is the only place where those
dependencies live. The engine can evaluate a journey regardless of the framework the
application uses.

**Testability.** The test client proves the split works. It calls the same `forge.execute`
that the Express adapter calls, with no HTTP, no routing, and no HTML rendering.

```ts
const client = harness.createClient();
const result = await client.post("/apply/details", {
  session: { answers: existingAnswers },
  body: { emailAddress: "test@example.com" },
});
```

The test client builds a `RequestSnapshot` from test options, captures response writes into
maps, and passes no renderer. The result exposes the render context for assertions: resolved
blocks, validation errors, navigation data, and answer state.

The same engine pipeline runs in tests and in production. A test that passes against the
render context exercises the same validation, reachability, hooks, and answer preparation
as a real request.

**Clear ownership.** The split draws a line through every request. Forge decides the journey
outcome. The adapter turns that outcome into a response.

When a redirect appears in a test result, the journey decided to redirect. When a validation
error appears in the render context, the journey produced it. The adapter did not modify the
errors. A journey bug lives inside Forge. A framework bug lives inside the adapter.

## Rendering shows the split at its clearest

Forge resolves block properties during the compiled resolve phase. By the time rendering
starts, every expression is evaluated, every field value is attached, and every validation
error is in place. The render context is complete data.

Component evaluators turn the resolved data into output. For Nunjucks components, their
factories receive the template environment supplied by the adapter. Forge renders children
before their parents, and the adapter wraps each child's output for the parent to use.

An authored `renderer()` assembles the rendered blocks into page output when the step
selects one, including through journey inheritance. Otherwise, the adapter's renderer
provides default page assembly. The adapter writes the resulting response.

When no adapter renderer is supplied, the pipeline stops after resolve. The render context stands
alone. This is why tests can assert on resolved page data without a template engine. A
different adapter can render the same journey with a different technology.
