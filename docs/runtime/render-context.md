# Render context

## Purpose

The render context is the runtime data structure Forge passes to the framework
adapter.

Forge does not render HTML in `forge-core`. The core runtime evaluates the step,
ancestor metadata, blocks, answers, validation state, and navigation metadata.
It then passes a `RenderContext` to the framework adapter.

The adapter and component renderers decide how that context becomes an HTTP
response.

## Why render context assembly is split

Render context assembly has two distinct responsibilities.

First, Forge evaluates the dynamic values in the compiled journey. This is done
by the compiled render function for the current step.

Second, Forge assembles the final `RenderContext`. This is done by runtime code
that attaches validation failures, resolves navigation metadata, adds backlinks,
and carries answers and data through to the framework adapter.

This keeps expression evaluation compiled, while keeping context assembly in
ordinary TypeScript code.

It also keeps `forge-core` independent of a rendering engine. Nunjucks, GOV.UK
components, MOJ components, or any other rendering stack sit behind the
framework and component adapter boundaries.

## Pipeline position

Render context assembly runs after access, answer preparation, navigation, and
any validation needed for the request.

For GET requests, the render context is built after optional entry validation.

For POST requests, the render context is built when submit hooks do not redirect
or throw an error. Validation failures from the submit lifecycle can be shown in
the render context.

Building the render context is the final Forge runtime step before the framework
adapter produces the HTTP response.

## Inputs and outputs

The main inputs are:

- the compiled render function for the current step
- the runtime evaluation context
- the current navigation evaluation
- validation failures for the current request
- navigation metadata captured when routes were mounted
- route params from the current request

The main output is a `RenderContext`.

The controller passes that context to the framework adapter. The adapter and
component renderers decide how to turn the context into a response.

## Key concepts

### Compiled render function

The compiled render function evaluates the renderable parts of a step.

It produces:

- evaluated step metadata
- evaluated journey ancestor metadata
- evaluated blocks

Static values are emitted directly into generated source. Expression values are
compiled through the shared expression compiler and evaluated against the
compiled render context.

The compiled render function may be synchronous or asynchronous depending on
the registered functions used by render expressions.

### Evaluated step metadata

Step metadata includes render-facing step properties.

The render compiler excludes executable structure such as hooks, blocks, and
reachability configuration. Those are owned by other runtime phases and should
not be exposed as ordinary render metadata.

If the step does not define a backlink, runtime can add one from the navigation
evaluation.

### Evaluated ancestors

Ancestor metadata describes the parent journeys for the current step.

The compiled render function evaluates each ancestor and composes ancestor paths
relative to their parents. The result gives the framework adapter enough
context to render journey-level metadata around the current step.

### Evaluated blocks

Blocks are passed through as evaluated data, not HTML.

Each evaluated block keeps its ID, block type, variant, and evaluated
properties. Component packages use the variant and properties later when the
framework adapter renders the final response.

The render compiler skips properties that belong to other phases, such as
formatters, parsers, validation rules, and dependency checks.

### Field values

Field blocks can receive values from prepared answers.

When a field block has no explicit value, the compiled render function uses the
shared field value resolver. This reads the answer history produced earlier in
the request lifecycle.

This keeps field values in the render context aligned with answer preparation.

### Iterator blocks

MAP iterators can produce blocks.

The render compiler emits loops for MAP iterators that yield block templates.
Those loops push evaluated blocks directly into the render result. Runtime does
not expand iterator templates into AST nodes.

Iterator-generated field blocks use deterministic compiled IDs so validation
failures can attach to the evaluated blocks.

### Nested blocks

Blocks can appear inside component properties, such as reveal-style component
configuration.

The render compiler treats block-shaped property values as structural render
values. It evaluates their properties and preserves their block identity so
validation attachment can walk nested block structures later.

### `RenderContextFactory`

`RenderContextFactory` assembles the final `RenderContext`.

It takes the compiled render result and adds runtime state:

- answers
- data
- validation failures
- navigation metadata
- active navigation state
- backlink information

It also decides whether validation failures should be shown. GET entry
validation and POST submit validation can both ask the render context to show
failures. When failures should not be shown, validation arrays are left empty.

### Validation attachment

Field validation failures are attached to evaluated blocks before the final
render context is returned.

Failures are grouped by block ID. For field blocks, failures are added to the
block's `validWhen` property. Nested blocks are walked recursively so validation
can attach inside component properties too.

Step/domain validation failures are exposed separately on the render context.

### Navigation metadata

The router stores navigation metadata when journeys are mounted.

During render context assembly, `RenderContextFactory` turns that stored
metadata into navigation metadata for the current page. It resolves any route
params in navigation paths and marks the active step and journeys.

## What can fail

Render context assembly should fail when Forge cannot build a context from the
compiled step and current request state.

Important failure cases include:

- the compiled render function is missing
- a generated render expression throws
- field value resolution receives answer state it cannot handle
- validation failures reference blocks that are not present in the render result
- the framework adapter cannot render the final context

Some of these failures happen before the framework adapter sees the context.
Failures inside the adapter belong to the framework integration layer.

The main rule to preserve is that `forge-core` produces render data, not HTML.
Component rendering and template rendering should stay behind the adapter and
component boundaries.

## Connection to other runtime docs

The request lifecycle doc explains when the render context is built for GET and
POST requests.

The evaluation context doc explains where answers, data, and validation state
come from.

The navigation and reachability doc explains how canonical paths and backlinks
are resolved before the render context is built.

The framework integration rendering doc explains how framework adapters and
component renderers turn the render context into a response.
