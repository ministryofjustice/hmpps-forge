# Rendering

## Purpose

Rendering turns a Forge `RenderContext` into an HTTP response.

`forge-core` orchestrates block rendering — registry lookup, visible-block
filtering, and nested-block walking — and drives the host's `ForgeRenderer`
methods to produce the HTML. It does this as real
work types run by the `WorkExecutor`, not a hand-rolled traversal. The framework
integration layer implements those render methods (template selection,
view-locals merge, page assembly) and writes the finished outcome through the
host framework.

This keeps the core engine independent of Express, Nunjucks, GOV.UK Frontend,
MOJ Frontend, or any other rendering stack.

## Where rendering starts

Rendering starts when the adapter calls
`forge.execute({ snapshot, responseBindings, renderer })`.

At that point Forge has already:

- prepared answers and data
- evaluated navigation and reachability
- run validation needed for the request
- built the `RenderContext`

Rendering is skipped when no `renderer` is supplied to `forge.execute`; in that
case the pipeline ends after the resolve phase and the outcome carries the
`RenderContext` with no `output`. When a `renderer` is supplied, the render phase
renders the blocks and page inside `forge-core` (driving the supplied renderer's
methods) and returns a `ForgeOutcome` of kind `render` whose `output` is the
assembled page. The `RenderContext` is also on the outcome as `context`, but the
adapter does not re-render it — it just writes `output` to the response.

## Inputs and outputs

The main input is a `RenderContext`.

The render context contains:

- step metadata
- ancestor metadata
- evaluated blocks
- navigation data
- answers and data
- field and domain validation errors

The main output is a framework response.

For the Express/Nunjucks adapter, that means rendering a HTML string and
sending it through the Express response.

## Data shape flow

All framework integrations start with the same input: a `RenderContext`.

After that point, the data shape is adapter-specific. An adapter might render
HTML, return JSON, stream a response, or pass the context into another rendering
system.

The Express/Nunjucks adapter uses these shapes:

1. `RenderContext` contains evaluated Forge runtime data.

2. `forge-core` walks the top-level blocks and drives the renderer's methods
   (here `NunjucksRenderer`) to turn them into rendered HTML strings.

3. Nested blocks inside component properties become rendered-block objects.

4. Component renderers receive component-facing block data.

5. Page templates receive a template context containing rendered blocks.

Those shapes are kept separate because they serve different boundaries. The
render context is the core-to-adapter contract. Component-facing blocks are the
adapter-to-component contract. The template context is the adapter-to-template
contract.

## Key concepts

### `forge.execute` and `ForgeRenderer`

The adapter's entry point into the engine is `forge.execute`. The
core-to-adapter rendering contract is the `ForgeRenderer<TOut>` interface, which
the adapter implements and passes as the `renderer` on the execution request.
Its methods are:

- `renderBlock(entry, block)` — render one evaluated block into `TOut` (the
  engine has already resolved `entry` from the component registry)
- `wrapNestedBlock(block, output)` — wrap a rendered nested block (the
  Nunjucks adapter returns `{ block, html }`)
- `assemblePage(context, renderedBlocks, requestState)` — combine the
  rendered blocks and render context into the page (`TOut`)

Rendering is skipped not by a method on the contract but by not supplying a
`renderer` to `forge.execute`; with no renderer the pipeline ends after the
resolve phase and the outcome carries the `RenderContext` with no `output`.

The adapter is also responsible for routing, building the `RequestSnapshot`,
providing the response bindings, and dispatching the outcome, but those are the
routing, response, and dispatch side covered by the adapter-contract doc.

`forge-core` does not know whether the adapter uses Nunjucks, React,
server-side templates, JSON, or another response format. It drives the
renderer's methods and returns the result as the `output` on a `render`
outcome.

Internally, `forge-core` runs this as work types via the `WorkExecutor`. A
`request.render` phase fans out a `render.render-blocks` work type and a
`render.assemble-page` work type. `render.render-blocks` fans out one
`render.render-blocks.block` child per registered top-level block; nested
`RenderBlock`s inside a block's properties become further
`render.render-blocks.block` children. The block work types call the renderer's
`renderBlock` and `wrapNestedBlock`, and `render.assemble-page` calls
`assemblePage` to produce the page.

### `RenderContext`

`RenderContext` is data, not markup.

It contains the evaluated values the adapter needs to render the page.

Top-level blocks are still block objects at this point. Each block has:

- an ID
- a block type
- a variant
- evaluated properties

They have not yet been rendered to HTML.

This lets framework integrations choose how page templates and component
renderers consume the data.

### Template context

`TemplateContext` is the data passed to the page template.

For the Express/Nunjucks adapter, it is mostly the `RenderContext`, but with
top-level blocks replaced by rendered HTML strings. It also includes any locals
provided by the Express app, response, journey views, or step view.

This means page templates do not need to know how to render individual Forge
blocks. They receive already-rendered block output, plus the step, ancestors,
navigation, answers, data, and validation errors needed to lay out the page.

### Page template rendering

The Express/Nunjucks adapter's renderer is `NunjucksRenderer`, which implements
the `ForgeRenderer<string>` interface (`renderBlock`, `wrapNestedBlock`,
`assemblePage`). It is passed as the `renderer` on the execution request, so the
engine's render phase calls its methods directly.

`NunjucksRenderer` assembles a full page in its `assemblePage` method.

`NunjucksRenderer` chooses the page template from the current step first, then
from the nearest ancestor with a template, then from the configured default
template.

It also merges view locals from ancestors and the current step. Ancestor locals
are applied from root to inner journey, and step locals are applied last.

### Block rendering

Blocks are rendered through the component registry.

Top-level blocks with `visibleWhen: false` are filtered out before rendering. For
each visible block, `forge-core` looks up the component registered for the block
variant. It converts the evaluated block into the component-facing block shape
and passes it to the renderer's `renderBlock`, which calls the component's
render function.

The component-facing shape keeps the authoring-level block discriminator and
variant, then spreads the evaluated block properties onto the object. Validation
failures are converted into an `errors` array when failures should be shown.

The component render function returns HTML. The page template then receives the
rendered block output as part of its template context.

### Nested blocks

Blocks can appear inside component properties.

Before a component is rendered, `forge-core` walks block properties and renders
nested blocks to a nested rendered-block shape (the renderer's
`wrapNestedBlock` builds the shape).

That nested shape contains:

- `block`, with the nested block metadata and properties
- `html`, with the rendered nested block output

This allows wrapper or reveal-style components to receive rendered child
content without needing to know about Forge's AST or runtime graph.

A nested block with `visibleWhen: false` is dropped during substitution.

    Note:
    We will probably move this `visibleWhen` check into the rendering compiler 
    function, as cutting out a block as early as possible in the process means 
    less unused work

### Validation errors

The render context controls whether validation failures should be shown.

When `showValidationFailures` is set, the resolve phase groups the request's
field validation failures by render block ID and attaches them to the matching
block as an `errors` array, so the blocks the render phase receives already
carry their errors. Field code stays as answer identity and debug metadata. The
render phase does not re-extract failures.

Each component receives errors in a small field-error shape:

- `message`
- `details`

Step/domain validation errors are passed through separately to the page
template.

### Component renderers

Component renderers are registered by variant.

Each component receives an evaluated block and an optional renderer object. The
renderer object lets a framework integration pass template-engine support to
component packages without making `forge-core` depend on that template engine.

For Nunjucks components, `buildNunjucksComponent` adapts a render function that
expects a Nunjucks renderer into a normal component registry entry.

### GOV.UK and MOJ components

The GOV.UK and MOJ component packages provide concrete component registry
entries.

Those packages translate Forge block data into the parameter shape expected by
the relevant GOV.UK or MOJ template, then render through the Nunjucks renderer
provided by the framework integration.

This keeps presentation-specific mapping outside `forge-core`.

## What can fail

Rendering should fail when the framework integration cannot turn a render
context into a response.

Important failure cases include:

- the selected page template cannot be found
- the page template throws while rendering
- a block variant is not registered in the component registry
- a component renderer throws
- nested block rendering receives unsupported block data
- the framework response cannot be written

Adapter errors should stay in the framework integration layer. Core runtime
errors are surfaced as a `ForgeOutcome` of kind `error` from `forge.execute`;
the host maps that error outcome to an HTTP error.

The main rule to preserve is that `forge-core` owns render data and orchestrates
block rendering, while framework and component packages own the rendering stack
it drives — template selection, page assembly, and the markup each component
produces.

## Connection to other docs

The runtime render context doc explains how `forge-core` builds the
`RenderContext`.

The component system docs explain how component registry entries are defined.

The framework adapter docs explain the broader adapter contract for routing,
requests, responses, redirects, errors, and rendering.
