# Rendering

## Purpose

Rendering turns a Forge `RenderContext` into an HTTP response.

`forge-core` prepares render data, but it does not own HTML generation. The
framework integration layer receives the render context, renders the page shell,
renders blocks through the component registry, and writes the response through
the host framework.

This keeps the core engine independent of Express, Nunjucks, GOV.UK Frontend,
MOJ Frontend, or any other rendering stack.

## Where rendering starts

Rendering starts when a runtime controller calls `FrameworkAdapter.render`.

At that point Forge has already:

- prepared answers and data
- evaluated navigation and reachability
- run validation needed for the request
- built the `RenderContext`

The adapter receives the render context with the original framework request and
response objects. From this point onwards, rendering is framework integration
work.

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

2. `TemplateRenderer` turns top-level blocks into rendered HTML strings.

3. Nested blocks inside component properties become rendered-block objects.

4. Component renderers receive component-facing block data.

5. Page templates receive a template context containing rendered blocks.

Those shapes are kept separate because they serve different boundaries. The
render context is the core-to-adapter contract. Component-facing blocks are the
adapter-to-component contract. The template context is the adapter-to-template
contract.

## Key concepts

### `FrameworkAdapter.render`

`FrameworkAdapter.render` is the rendering boundary from `forge-core` into a
framework adapter.

The core runtime does not know whether the adapter will use Nunjucks, React,
server-side templates, JSON, or another response format. It only passes the
render context to the adapter.

Adapters should treat `RenderContext` as the core contract for rendering a
step response.

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

The Express/Nunjucks adapter uses `TemplateRenderer` to render a full page.

`TemplateRenderer` chooses the page template from the current step first, then
from the nearest ancestor with a template, then from the configured default
template.

It also merges view locals from ancestors and the current step. Ancestor locals
are applied from root to inner journey, and step locals are applied last.

### Block rendering

Blocks are rendered through the component registry.

For each visible block, `TemplateRenderer` looks up the component registered for
the block variant. It converts the evaluated block into the component-facing
block shape and calls the component's render function.

The component-facing shape keeps the authoring-level block discriminator and
variant, then spreads the evaluated block properties onto the object. Validation
failures are converted into an `errors` array when failures should be shown.

The component render function returns HTML. The page template then receives the
rendered block output as part of its template context.

### Nested blocks

Blocks can appear inside component properties.

Before a component is rendered, `TemplateRenderer` can walk block properties and
render nested blocks to a nested rendered-block shape.

That nested shape contains:

- `block`, with the nested block metadata and properties
- `html`, with the rendered nested block output

This allows wrapper or reveal-style components to receive rendered child
content without needing to know about Forge's AST or runtime graph.

Blocks with `visibleWhen: false` are skipped.

    Note:
    We will probably move this `visibleWhen` check into the rendering compiler 
    function, as cutting out a block as early as possible in the process means 
    less unused work

### Validation errors

The render context controls whether validation failures should be shown.

When failures are visible, `TemplateRenderer` extracts failed validation results
from a field block's `validWhen` property and passes them to the component as
errors.

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
errors should be raised before `FrameworkAdapter.render` is called.

The main rule to preserve is that `forge-core` owns render data, while
framework and component packages own rendering.

## Connection to other docs

The runtime render context doc explains how `forge-core` builds the
`RenderContext`.

The component system docs explain how component registry entries are defined.

The framework adapter docs explain the broader adapter contract for routing,
requests, responses, redirects, errors, and rendering.
