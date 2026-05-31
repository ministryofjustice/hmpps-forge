# Adapter contract

## Purpose

The adapter contract is the boundary between `forge-core` and a web framework.

Forge evaluates journeys and returns structured outcomes. It does not mount
routes, read HTTP requests, or write HTTP responses. The adapter owns those
responsibilities, consuming the engine's public surface to bridge the gap.

The contract lets the core runtime stay framework-independent while giving
framework integrations full control over routing, request handling, and response
dispatch.

## Why Forge uses adapters

Forge evaluates journeys, but web frameworks own HTTP details.

Different frameworks have different request objects, response objects, router
APIs, error handling models, and rendering mechanisms. If `forge-core` depended
on one of those models directly, the engine would become harder to reuse and
test.

Adapters keep that boundary explicit:

- `forge-core` exposes routes as data (`ForgeTopology`) and an `evaluate` function
- the adapter registers those routes in the host framework
- the adapter converts framework requests into a `RequestSnapshot`
- the adapter calls `forge.evaluate(snapshot)` and receives a `ForgeOutcome`
- the adapter dispatches the outcome (render, redirect, or error) using framework APIs

The Express/Nunjucks package is the reference implementation. It is not the only
shape the contract allows.

## Engine surface

The adapter consumes three things from a configured `Forge` instance:

| Method | What it provides |
|--------|-----------------|
| `forge.getTopology()` | A `ForgeTopology` containing every registrable route (node ID, path template, methods, kind) |
| `forge.evaluate(snapshot, options?)` | Takes a `RequestSnapshot` and optional `EvaluateOptions` (including `ResponseBindings`), returns a `ForgeOutcome` |
| `forge.getInstrumentation()` | The instrumentation instance, so adapters can nest request spans |
| `forge.getLogger()` | The configured logger |

## Inputs and outputs

The adapter provides a `RequestSnapshot` to the engine. A snapshot contains:

- `nodeId` (which compiled node to evaluate, taken from the matched route)
- method (GET or POST)
- location (origin, href, pathname, basePath)
- params, query, post body
- headers, cookies
- session
- request state

The engine returns a `ForgeOutcome`:

- `{ kind: 'render', context, componentRegistry }` - render a page
- `{ kind: 'navigate', url }` - redirect to a URL
- `{ kind: 'error', error }` - surface a structured error

The outcome is pure data. Response IO (headers, cookies) is handled live
during evaluation through the adapter-provided `ResponseBindings`, not
carried on the outcome.

## Key concepts

### `RequestSnapshot`

`RequestSnapshot` is the framework-agnostic input to evaluation.

The adapter builds it from whatever the host framework provides. It contains
everything the engine needs to evaluate a step: the node to evaluate, the HTTP
method, location data, all request values, and the session.

This keeps compiled functions and runtime evaluation away from framework request
objects.

### `ForgeOutcome`

`ForgeOutcome` is the engine's output. It is a discriminated union with three
variants:

- **render** - includes a `RenderContext` and the `ComponentRegistry` needed to
  resolve block variants into rendered HTML
- **navigate** - includes the resolved redirect URL
- **error** - includes a `ForgeError` with a typed `ForgeErrorCode`
  (`node-not-found`, `method-not-supported`)

The adapter interprets this outcome into the framework's response model.

### `ResponseBindings`

The adapter provides a `ResponseBindings` implementation when calling
`forge.evaluate(snapshot, { response })`. This is a callback interface
with methods like `setHeader`, `getHeader`, `setCookie`, `getCookie`,
`getAllHeaders`, and `getAllCookies`.

Effect hooks call these bindings directly during evaluation. The engine
never touches the real response object -- the adapter decides what each
method does. The Express adapter writes live to `res`; the test client
records into local Maps for assertions.

This mirrors how session already works: the adapter owns the mutable
reference, and the engine calls into it during evaluation.

### `ForgeTopology`

`ForgeTopology` is the route table exposed by the engine after packages are
registered.

Each `ForgeRoute` contains:

- `nodeId` - the identifier to pass back on a `RequestSnapshot`
- `kind` - `'step'` or `'journey'`
- `templatePath` - the full URL path template (e.g. `/forms/order/:id/details`)
- `basePath` - the owning journey's base path template
- `methods` - which HTTP methods apply (`['GET', 'POST']` for steps, `['GET']` for journey roots)
- `title` - optional display title

The adapter registers one route per entry, using the template path and methods
to wire up the framework's routing table.

### Route handler pattern

Each adapter creates its own route handlers. A handler:

1. Converts the framework request into a `RequestSnapshot` (using the matched
   route's `nodeId` and `basePath`, plus request data)
2. Creates a `ResponseBindings` implementation for this request
3. Calls `forge.evaluate(snapshot, { response })`
4. Dispatches the outcome:
   - render: resolve blocks through the component registry, render a template,
     send the HTML response
   - navigate: perform a framework redirect
   - error: forward to the framework's error model

Response writes (headers, cookies) happen live during step 3 via the bindings.
There is no post-evaluate flush step.

### Express/Nunjucks reference adapter

`createExpressRouter(forge, { nunjucksEnv })` is the reference implementation.

It:

- reads routes from `forge.getTopology()`
- registers an Express handler for each route's methods
- builds a `RequestSnapshot` from each Express request (including `res.locals` as state)
- creates `ResponseBindings` that write live to the Express `res` (with a
  local cookie cache for read-after-set, since `res.cookie` has no getter)
- calls `forge.evaluate(snapshot, { response })`
- renders with Nunjucks through `TemplateRenderer`, redirects with `res.redirect`,
  or forwards errors with `next(createHttpError(...))`

`ExpressFrameworkAdapter.configure({ nunjucksEnv })` is a back-compat wrapper
that returns a builder conforming to the `ForgeRouterAdapter` interface. Both
produce the same router.

    # Note
    We've never tried to implement anything but Express/Nunjucks here. We think
    that this may likely need a restructure in future if it were to support something
    like ReactJS, though with the lack of support for anything but Nunjucks in 
    the official GOVUK packages, there's not really much push to explore this 
    currently.

### Test adapter (`ForgeTestClient`)

`ForgeTestClient` is an in-memory adapter used for testing journeys without HTTP
or HTML rendering.

It follows the same contract as a real adapter:

- reads routes from `forge.getTopology()`
- matches a test path against route template paths to find the target node
- extracts params from the matched path template
- builds a `RequestSnapshot` from the matched route and test options (session,
  state, body, headers, cookies)
- creates recording `ResponseBindings` (Maps for headers and cookies)
- calls `forge.evaluate(snapshot, { response })`
- maps the `ForgeOutcome` to a `TestResult`, sourcing headers and cookies from
  the recording bindings

Because it consumes the same `evaluate` + `getTopology` surface as the Express
adapter, tests exercise the full engine pipeline without framework dependencies.
The test adapter provides its own recording bindings instead of live framework
writes, exposing captured response data for assertions alongside the outcome.

## What can fail

Adapter integration should fail when the host framework cannot satisfy the
contract the engine expects.

Important failure cases include:

- a request cannot be converted into a `RequestSnapshot`
- `forge.evaluate()` throws (internal engine error)
- the adapter cannot interpret a `ForgeOutcome` variant
- the adapter's `ResponseBindings` implementation fails during evaluation
- rendering fails inside the adapter's template layer
- redirect targets cannot be written to the response
- errors cannot be forwarded into the framework's error model

The main rule to preserve is that framework-specific objects should not leak
into `forge-core`. The `RequestSnapshot` is the inbound boundary; the
`ForgeOutcome` is the outbound boundary.

## Connection to other docs

The request lifecycle doc explains what happens inside `forge.evaluate()` for
each request type.

The framework integration rendering doc explains how an adapter turns a render
outcome's `RenderContext` into a response.

The component system docs explain how component registry entries are supplied
through the render outcome.
