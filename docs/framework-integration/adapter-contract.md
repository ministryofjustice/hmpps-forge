# Adapter contract

## Purpose

The adapter contract is the boundary between `forge-core` and a web framework.

Forge needs to mount routes, read requests, write responses, redirect, forward
errors, and hand off render contexts. It does not need to depend on a specific
HTTP framework to do those things.

The adapter contract lets the core runtime stay framework-independent while
still giving framework integrations enough control over routing and response
handling.

## Why Forge uses adapters

Forge evaluates journeys, but web frameworks own HTTP details.

Different frameworks have different request objects, response objects, router
APIs, error handling models, and rendering mechanisms. If `forge-core` depended
on one of those models directly, the engine would become harder to reuse and
test.

Adapters keep that boundary explicit:

- `forge-core` decides which route handlers are needed
- the adapter mounts those handlers into the host framework
- the adapter converts framework requests into Forge request objects
- the adapter converts framework responses into Forge response objects
- the adapter owns redirects, errors, and final rendering

The Express/Nunjucks package is the reference implementation. It is not the only
shape the contract allows.

## Pipeline position

The adapter is used at two points.

First, Forge uses it during route mounting. `ForgeRouter` asks the adapter to
create routers, mount child routers, and register GET and POST handlers.

Second, Forge uses it during request handling. Controllers use the adapter to
convert requests and responses, perform redirects, forward errors, and render
the final response.

## Inputs and outputs

The main input to an adapter builder is `FrameworkAdapterDependencies`.

Those dependencies include:

- the component registry
- the logger

The main output is a `FrameworkAdapter`.

The adapter then provides the concrete framework objects and behaviours needed
by the runtime:

- routers
- route registration
- request conversion
- response conversion
- redirects
- error forwarding
- rendering

## Key concepts

### `FrameworkAdapterBuilder`

`FrameworkAdapterBuilder` builds an adapter when Forge has the dependencies the
adapter needs.

This lets adapter configuration stay separate from Forge-owned dependencies.
For example, the Express/Nunjucks adapter is configured with a Nunjucks
environment first. Forge later supplies the component registry and logger when
it builds the adapter.

### `FrameworkAdapter`

`FrameworkAdapter` is the runtime contract used by `forge-core`.

It covers:

- router creation
- router mounting
- GET route registration
- POST route registration
- request conversion
- response conversion
- redirects
- error forwarding
- rendering

Each adapter method should translate between Forge's framework-independent
contract and the host framework's native APIs.

### Router creation and mounting

Forge builds routes from compiled journey and step plans.

The adapter decides how those routes are represented in the host framework. In
Express, this means creating routers with merged params, mounting child routers,
and registering handlers with `router.get` and `router.post`.

The core router owns the route structure. The adapter owns the framework calls
that mount that structure.

### Step handlers

Forge route handlers are asynchronous functions that receive the framework's
native request and response objects.

The adapter registers those handlers with the host framework. It should also
handle the framework's error model. In Express, the adapter wraps handlers so
rejected promises are passed to `next`.

### `StepRequest`

`StepRequest` is the request shape used by Forge runtime.

The adapter converts the framework request into this shape. It exposes:

- method
- URL and location data
- headers
- cookies
- route params
- query values
- POST values
- session
- request state

This keeps generated functions and runtime controllers away from framework
request objects.

### `StepResponse`

`StepResponse` is the response shape used by Forge runtime.

The adapter converts the framework response into this shape. It exposes the
response operations Forge effects need, such as setting headers and cookies.

The native response object still belongs to the framework. `StepResponse` is the
small Forge-facing surface over it.

### Redirects

Controllers ask the adapter to redirect.

Forge resolves the target route before calling the adapter. The adapter then
performs the framework-specific redirect. In Express, this is `res.redirect`.

### Error forwarding

The adapter owns the framework-specific error handoff.

For Express, errors are forwarded to `next` when that callback is available.
Other framework integrations can forward or throw according to their own error
model.

### Render handoff

Controllers pass a `RenderContext` to `FrameworkAdapter.render`.

The adapter decides how to turn that context into a response. The
Express/Nunjucks adapter delegates to `TemplateRenderer`, then sends the HTML
through the Express response.

Rendering details are covered in the framework integration rendering doc.

    # Note
    We've never tried to implement anything but Express/Nunjucks here. We think
    that this may likely need a restructure in future if it were to support something
    like ReactJS, though with the lack of support for anything but Nunjucks in 
    the official GOVUK packages, there's not really much push to explore this 
    currently.

### Express/Nunjucks reference adapter

`ExpressFrameworkAdapter` shows one complete implementation of the contract.

It:

- creates Express routers
- mounts child routers
- registers GET and POST handlers
- converts Express requests to `StepRequest`
- converts Express responses to `StepResponse`
- redirects with Express
- forwards errors into Express error handling
- renders with Nunjucks through `TemplateRenderer`

It also copies `res.locals` into request state before route handling. This makes
framework-provided locals available through the Forge request snapshot.

## What can fail

Adapter integration should fail when the host framework cannot satisfy the
contract Forge expects.

Important failure cases include:

- routes cannot be mounted
- a request cannot be converted into `StepRequest`
- a response cannot be converted into `StepResponse`
- redirect targets cannot be written to the response
- errors cannot be forwarded into the framework's error model
- rendering fails inside the adapter

The main rule to preserve is that framework-specific objects should not leak
into `forge-core`. Convert them at the adapter boundary.

## Connection to other docs

The request lifecycle doc explains when controllers call adapter methods during
runtime.

The framework integration rendering doc explains how `FrameworkAdapter.render`
turns a `RenderContext` into a response.

The component system docs explain how component registry entries are supplied to
the adapter.
