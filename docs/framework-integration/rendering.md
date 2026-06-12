# Rendering

## Purpose

Rendering turns a Forge `RenderContext` into host-specific output — HTML
strings for Nunjucks, with other backends (React nodes, static output) able to
plug into the same seam.

Rendering is split into two roles, following the React model where the
reconciler drives a pluggable renderer (`react-dom`) rather than owning DOM
production itself:

- **The engine owns the block walk.** The orchestrator filters visibility,
  resolves each block's component registry entry, renders nested blocks into
  their parent's properties, attaches validation errors, and records one trace
  decision per block rendered.
- **The renderer owns host output.** A `ForgeRenderer<TOut>` produces output
  for one block at a time when the orchestrator calls it, and assembles the
  final page from the block outputs.

This keeps the core engine independent of Express, Nunjucks, GOV.UK Frontend,
MOJ Frontend, or any other rendering stack, while giving it full visibility of
rendering work.

## Binding a renderer

The renderer binds at orchestrator construction and lives for the lifetime of
that orchestrator. Adapters do the composition for you — `createExpressRouter`
builds the `NunjucksRenderer` and the `ForgeOrchestrator` internally:

```typescript
import { Forge } from '@ministryofjustice/hmpps-forge/core'
import { createExpressRouter } from '@ministryofjustice/hmpps-forge/express-nunjucks'

const forge = new Forge({ logger }).registerPackage(myPackage)
app.use(createExpressRouter(forge, { nunjucksEnv }))
```

Composing by hand is the same two lines the adapter runs:

```typescript
import { ForgeOrchestrator } from '@ministryofjustice/hmpps-forge/core'

const orchestrator = new ForgeOrchestrator(forge, new NunjucksRenderer({ nunjucksEnv }))
```

The renderer's output type flows through the orchestrator's types: an
orchestrator bound to `NunjucksRenderer` is `ForgeOrchestrator<string>`, and its
render outcomes carry `output: string`. An orchestrator constructed without a
renderer produces context-only render outcomes — this is how the test harness
runs journeys without rendering anything. The `Forge` engine itself carries no
renderer and no output type.

## Where rendering happens in the request lifecycle

Rendering is the last two units of the orchestrator's pipeline:

1. **Render evaluation** (a pipeline phase): runs the step's compiled render
   plan to produce evaluated block data, resolves step metadata, and hydrates
   the `RenderContext`.
2. **Render output** (the terminal): walks the context's blocks, calls the
   bound renderer once per block (nested blocks included, children before
   parents), asks the renderer to assemble the page, and produces the render
   outcome.

Both stages record per-unit trace decisions when the request is traced:
`block-evaluation` units time each compiled block function, and `block-render`
units time each block's host render — the same per-component visibility React's
profiler gets from Fiber.

## The `ForgeRenderer` interface

A renderer implements three operations:

- `renderBlock(entry, block)` — produce output for one block. The engine has
  already resolved the registry `entry`, rendered nested blocks into the
  block's properties, and attached validation errors. The renderer calls the
  component's render function with its host context (for Nunjucks, a cached
  template-rendering proxy) and guards the output type.
- `wrapNestedBlock(block, output)` — wrap a rendered child for embedding in
  its parent's properties. The Nunjucks renderer returns
  `{ block, html }`, so wrapper or reveal-style components receive rendered
  child content without knowing about Forge's runtime graph.
- `assemblePage(context, renderedBlocks, requestState)` — produce the final
  page from the render context, the top-level block outputs in order, and the
  adapter-supplied request state (for Express, app and response locals).

## The outcome

A render outcome carries all three layers:

- `context` — the `RenderContext` data (blocks as data, step and ancestor
  metadata, navigation, answers, validation errors)
- `renderedBlocks` — the top-level block outputs in render order
- `output` — the assembled page

The adapter writes `output` to its native response. Consumers that compose
their own page can use `renderedBlocks` and `context` instead.

## The Nunjucks renderer

`NunjucksRenderer` owns the Nunjucks-specific parts:

- **Component rendering.** Components receive a render-compatible proxy in
  place of the raw environment; it caches resolved `Template` objects so
  repeated component renders skip the loader chain. A component that does not
  return a string fails with a wrapped error naming the variant.
- **Template resolution.** The page template comes from the current step's
  `view.template` first, then the nearest ancestor with a template, then the
  configured default (`form-step`). The `.njk` extension is appended when
  missing.
- **View locals.** Ancestor locals merge root-first, step locals apply last,
  and all of them override the adapter-supplied request state.
- **Page assembly.** The page template receives the rendered block strings
  plus the step, ancestors, route tree, navigation, answers, data, and
  validation errors needed to lay out the page (`TemplateContext`).

For Nunjucks components, `buildNunjucksComponent` adapts a render function that
expects a Nunjucks renderer into a normal component registry entry. The GOV.UK
and MOJ component packages provide concrete entries that translate Forge block
data into the parameter shapes their templates expect.

## Validation errors

The render context controls whether validation failures are shown. When they
are, the engine's walk extracts failed results from a field block's `validWhen`
property and attaches them to the block as an `errors` array
(`{ message, details }`) before the renderer sees it. Step/domain validation
errors pass through separately on the render context for the page template.

## What can fail

- an unknown block variant fails inside the engine's walk, naming the variant
  and listing the registered ones
- a component render that throws, or returns the wrong output type, fails
  inside the renderer with a wrapped error
- a missing or throwing page template fails inside `assemblePage`
- writing the response can fail in the adapter

The rule to preserve: the engine owns render data and the block walk, the
renderer owns host output, and the adapter owns the transport.

## Connection to other docs

The runtime render context doc explains how `forge-core` builds the
`RenderContext`.

The component system docs explain how component registry entries are defined.

The framework adapter docs explain the broader adapter contract for routing,
requests, responses, redirects, and errors.
