# Adapter contract

## Purpose

The adapter contract is the boundary between `forge-core` and a web framework.

Forge evaluates journeys and returns structured outcomes. It does not mount
routes, read HTTP requests, or write HTTP responses. The host adapter owns those
responsibilities, consuming the engine's public surface to bridge the gap.

The contract lets the core runtime stay framework-independent while giving
framework integrations full control over routing, request handling, and response
dispatch.

## Why Forge uses adapters

Forge evaluates journeys, but web frameworks own HTTP details.

Different frameworks have different request objects, response objects, router
APIs, error-handling models, and rendering mechanisms. If `forge-core` depended
on one of those models directly, the engine would become harder to reuse and
test.

Adapters keep that boundary explicit, and the host stays in control of the
request:

- `forge-core` exposes its routes as data (`ForgeTopology`) and a single
  execution entry point (`forge.execute`)
- the adapter registers those routes with its framework's router
- when a request arrives, the adapter turns it into a `RequestSnapshot`, calls
  `forge.execute({ snapshot, responseBindings?, renderer? })`, and acts on the
  returned `ForgeOutcome`
- the engine never calls back into the adapter to resolve routes, build
  snapshots, or commit responses. The only host objects it uses during
  evaluation are the optional `ResponseBindings` sink (for hook effects that set
  headers or cookies) and the optional `ForgeRenderer` (during the render phase)

The Express/Nunjucks package is the reference implementation. It is not the only
shape the contract allows.

## Engine surface

The adapter holds a configured `Forge` instance and drives every request through
it. `forge-core` does not expose `RequestPipeline` to the host; `Forge`
constructs it internally.

| Method | What it provides |
|--------|-----------------|
| `forge.getTopology()` | A `ForgeTopology` (`{ routes }`) listing every registrable route (`nodeId`, `kind`, `templatePath`, `basePath`, `methods`, optional `title`) |
| `forge.execute({ snapshot, responseBindings?, renderer? })` | Looks up the node by `snapshot.nodeId`, evaluates it, and resolves to a `ForgeOutcome<unknown>` for the host to dispatch. Node lookup and evaluation failures resolve as error outcomes |
| `forge.getLogger()` | The configured logger |
| `forge.getInstrumentation()` | The configured request instrumentation dispatcher |

`forge.execute` is the single entry point. The host builds the `RequestSnapshot`
and passes it in; `execute` returns a `Promise<ForgeOutcome<unknown>>`. There is
no host-implemented config object and no engine-driven `createSnapshot`/`commit`
step — the snapshot is an input and the outcome is the return value.

For request observability, `Forge` owns instrumentation through
`new Forge({ instrumentation: { sinks: [...] } })`. The runtime emits
`RequestTraceEvent` objects to those sinks after the request, and emits a
partial trace if evaluation fails after a node has been resolved.

## Inputs and outputs

The host builds a `RequestSnapshot` from its native request and passes it in on
the execution request. A snapshot contains:

- `nodeId` (which compiled node to evaluate, taken from the matched route)
- `method` (GET or POST)
- `location` (origin, href, pathname, basePath)
- `params`, `query`, `post` body
- `headers`, `cookies`
- `state` (adapter-managed request state, e.g. Express `res.locals`)
- `session`

`forge.execute` resolves to a `ForgeOutcome<TOut>`, a discriminated union the
host dispatches:

- `{ kind: 'render', context, output? }` - render a page. `context` is the
  `RenderContext`; `output` is the assembled result, present only when a
  `ForgeRenderer` was supplied
- `{ kind: 'navigate', url }` - redirect to a URL
- `{ kind: 'error', error }` - the `ForgeError` instance, with optional `status`
  and `statusCode` hints for the adapter

Response IO (headers, cookies) is written during evaluation through the
host-provided `ResponseBindings`; the host then dispatches the returned outcome
to its framework. An error outcome carries the Error instance itself so the
adapter can preserve its message, stack, Forge diagnostics, and other
properties. Errors thrown during request execution keep their identity. A
non-Error thrown value is converted to an Error with the original value as its
`cause`.

## Key concepts

### `RequestSnapshot`

`RequestSnapshot` is the framework-agnostic input to evaluation.

The adapter builds it from whatever the host framework provides. It contains
everything the engine needs to evaluate a node: the node to evaluate, the HTTP
method, location data, all request values, request state, and the session.

This keeps compiled functions and runtime evaluation away from framework request
objects.

### `forge.execute`

`forge.execute(request)` is the engine's only execution entry point. `request`
is a `ForgeExecutionRequest`:

- `snapshot` - the `RequestSnapshot` to evaluate (required)
- `responseBindings` - an optional `ResponseBindings` sink; defaults to
  `NO_OP_RESPONSE_BINDINGS`
- `renderer` - an optional `ForgeRenderer`; when omitted, a render outcome
  carries only its `context` and no `output`

`Forge` resolves `snapshot.nodeId` to a registered node and runs the runtime
against it. Failures from node lookup or evaluation resolve as error outcomes;
the execution promise does not reject for those failures. The host drives this
call directly; the engine does not call back into the host to assemble the
request.

### `ForgeOutcome`

`ForgeOutcome<TOut>` is the engine's output, returned from `forge.execute`. The
host inspects it and dispatches it to its framework's response model. It is a
discriminated union with three variants:

- **render** - carries a `RenderContext` (`context`) and an optional `output`.
  When a `ForgeRenderer` was supplied, the engine resolves and assembles the
  page and returns the assembled result on `output`; otherwise `output` is
  omitted and the host renders from `context` itself. There is no component
  registry on the outcome — component lookup happens inside the engine's render
  phase
- **navigate** - carries the resolved redirect `url`
- **error** - carries a `ForgeError`, which extends `Error` with optional
  `status` and `statusCode` hints. The host adapter decides how to represent that
  Error in its framework. Authored errors and exceptions raised during request
  execution use this same outcome. Forge preserves an Error instance and its
  diagnostic data rather than replacing it, and does not assign an HTTP status
  when the Error has none

### `ResponseBindings`

`ResponseBindings` is the sink hook effects use to write response headers and
cookies during evaluation. It is a callback interface with two methods:

- `setHeader(name, value)`
- `setCookie(name, value, options?)`

The host decides what each method does. The Express handler writes straight
through to the response (`res.setHeader`, `res.cookie`); the test client
captures the writes into Maps for assertions. `forge-core` ships
`NO_OP_RESPONSE_BINDINGS` and uses it when the execution request supplies no
bindings. `forge-core` does not buffer responses itself — there is no
`BufferedResponseBindings`; any buffering or flushing is the host's choice.

### `ForgeRenderer`

`ForgeRenderer<TOut>` is the optional render strategy the host supplies on the
execution request. The engine's render phase drives it; the host does not render
blocks itself. It has three methods:

- `renderBlock(entry, block)` - render one evaluated block to `TOut` (the engine
  has already resolved `entry` from the component registry)
- `wrapNestedBlock(block, output)` - wrap a rendered nested block
- `assemblePage(context, renderedBlocks, requestState)` - assemble the rendered
  blocks and render context into the page output

When no renderer is supplied, the pipeline ends after the resolve phase and the
render outcome carries only `context`. See the rendering doc for the full render
flow.

### `ForgeTopology`

`ForgeTopology` (`{ routes }`) is the route table the engine exposes after
packages are registered.

Each `ForgeRoute` contains:

- `nodeId` - the identifier to pass back on a `RequestSnapshot`
- `kind` - `'step'` or `'journey'`
- `templatePath` - the full URL path template (e.g. `/forms/order/:id/details`)
- `basePath` - the owning journey's base path template
- `methods` - which HTTP methods apply (`['GET', 'POST']` for steps, `['GET']`
  for journey roots)
- `title` - optional display title

The adapter registers one route per entry, using the template path and methods
to wire up the framework's routing table.

### Route handler pattern

Each adapter creates its own route handlers. The host drives the whole request;
the engine is one call inside the handler. A handler:

1. matches the request to a `ForgeRoute` (the framework's router already did this
   when the route was registered from the topology)
2. builds a `RequestSnapshot` from the native request
3. builds a `ResponseBindings` sink (or omits it to use the no-op default)
4. calls `forge.execute({ snapshot, responseBindings, renderer })` and awaits the
   `ForgeOutcome`
5. dispatches the outcome:
   - render: send the assembled `output` as the response body (or render
     `context` itself when no renderer was supplied)
   - navigate: perform a framework redirect to `url`
   - error: forward the `ForgeError` to the framework's error model

Response writes (headers, cookies) happen through the `ResponseBindings` during
evaluation, so by the time the handler dispatches the outcome they have already
been applied to whatever sink the host provided.

### Express/Nunjucks reference adapter

`createExpressRouter(forge, { nunjucksEnv, defaultTemplate? })` is the reference
implementation. It returns an `express.Router`.

It creates a `NunjucksRenderer`, reads routes from `forge.getTopology()`, and
registers one `ExpressHandlerFactory.create(forge, route, logger, renderer)`
handler per route method (`router.get` / `router.post`).

Each handler (`ExpressHandlerFactory`):

- builds the `RequestSnapshot` with `ExpressSnapshotFactory.create(route, req, res)`
  (merging `req.app.locals`, `res.locals`, and any `req.state` into `state`, and
  using `req.session` as the session)
- builds a live `ResponseBindings` that writes straight to the response
  (`res.setHeader`, `res.cookie`) — nothing is buffered
- calls `forge.execute({ snapshot, responseBindings, renderer })`
- commits the returned outcome: `navigate` redirects with `res.redirect(url)`;
  `error` stamps `status`, `statusCode` and `expose` onto the same Error (using
  `error.status ?? error.statusCode ?? 500`) before passing it to `next`;
  `render` sends the assembled output with
  `res.type('html').send(output)` (or a 500 when a render outcome has no
  `output`, which means no renderer was bound)

`NunjucksRenderer` implements `ForgeRenderer<string>`: `renderBlock` calls the
component entry's `render`, `wrapNestedBlock` returns `{ block, html }`, and
`assemblePage` selects the page template and renders it. See the rendering doc
for detail.

    # Note
    We've never tried to implement anything but Express/Nunjucks here. We think
    that this may likely need a restructure in future if it were to support something
    like ReactJS, though with the lack of support for anything but Nunjucks in 
    the official GOVUK packages, there's not really much push to explore this 
    currently.

### Test client

`forge-core` ships a test harness that drives the same `forge.execute` path
without HTTP or HTML rendering — there is no separate test adapter type.

`ForgeTestHarness` wraps a `Forge` instance (with a silent logger). Its
`registerGlobalComponents`, `registerGlobalFunctions`, and `registerPackage`
methods delegate to `Forge`, and `createClient()` returns a `ForgeTestClient`.

`ForgeTestClient.get(path, options?)` / `.post(path, options?)`:

- resolves the path to a route with
  `TestRouteResolver.resolve(path, method, forge.getTopology())`
- builds a `RequestSnapshot` with `TestSnapshotFactory.create(method, path, resolved, options)`
  from the test options (session, state, body, headers, cookies)
- creates a `ResponseBindings` that captures headers and cookies into Maps
- calls `forge.execute({ snapshot, responseBindings })` with no renderer, then
  maps the `ForgeOutcome` to a `TestResult`:
  - `navigate` becomes `{ type: 'redirect', url, headers, cookies }`
  - `error` becomes `{ type: 'error', error, headers, cookies }`, preserving the
    same `ForgeError` instance
  - `render` becomes `{ type: 'render', context, headers, cookies }` plus
    `getBlocksByVariant` and `getValidationErrorsByFieldCode` helpers

Because it goes through the same `forge.execute` as the Express adapter, tests
exercise the full engine pipeline without framework dependencies. With no
renderer supplied, render results expose the `RenderContext` (block data) for
assertions rather than HTML.

## What can fail

Adapter integration should fail when the host framework cannot satisfy the
contract the engine expects.

Important failure cases include:

- the host cannot convert a request into a `RequestSnapshot`
- `snapshot.nodeId` does not match a registered node (`forge.execute` resolves
  an error outcome)
- request evaluation fails (`forge.execute` preserves the Error and resolves an
  error outcome)
- the host cannot interpret a `ForgeOutcome` variant
- the host's `ResponseBindings` implementation fails during evaluation (an
  error outcome)
- rendering fails inside the supplied `ForgeRenderer` (an error outcome)
- redirect targets cannot be written to the response
- errors cannot be forwarded into the framework's error model

The main rule to preserve is that framework-specific objects should not leak
into `forge-core`. The `RequestSnapshot` is the inbound boundary; the
`ForgeOutcome` is the outbound boundary.

## Connection to other docs

The request lifecycle doc explains what happens inside `forge.execute()`
for each request type.

The framework integration rendering doc explains how an adapter turns a render
outcome's `RenderContext` into a response.

The component system docs explain how component registry entries are resolved
during the engine's render phase.
