---
title: renderer()
slug: renderer
section: reference
path: reference/renderer
nav: Authoring API/Functions
order: 35
description: Defines a step renderer that assembles rendered blocks into page output
teaches: [renderer, factory, blocksSchema, blockSchema, renderer-context, structured-blocks]
prerequisites: [component, step]
related:
  concept: how-blocks-resolution-and-rendering-connect
  reference: component, step, journey, create-forge-package, forge-test-harness
---

# `renderer()`

`renderer()` defines a step renderer that assembles rendered blocks into page output.

```typescript
import { z } from 'zod'
import { blockSchema, renderer } from '@ministryofjustice/hmpps-forge/core/components'

const Page = renderer('Page', {
  blocksSchema: z.array(blockSchema),
  factory: () => blocks =>
    `<main>${blocks.map(block => block.html).join('')}</main>`,
})

// In a step definition:
renderer: Page()
```

---

## Reference

### `renderer(variant, options)`

Creates a named step renderer. Calling it produces an invocation for the `renderer`
property of a [step](./step) or [journey](./journey).

```typescript
function renderer<
  TProps extends object,
  TBlocks,
  TContext extends RendererFunctionContext,
  TDeps = Record<string, never>,
>(
  variant: string,
  options: RendererOptions<TProps, TBlocks, TContext, TDeps>,
): ForgeStepRenderer<TProps, TBlocks, TContext, TDeps>
```

#### Parameters

:::param
---
name: variant
type: string
required: true
---
The renderer's registration name. The invocation records this name so rendering can find
its evaluator. There is no anonymous overload.
:::

:::param
---
name: options
type: RendererOptions<TProps, TBlocks, TContext, TDeps>
required: true
---
The evaluator factory, optional block schema, and optional authoring preparation.
:::

#### Options

:::param
---
name: factory
type: "(deps: TDeps) => (blocks, props, context) => unknown"
required: true
---
Builds the evaluator during context preparation for each request. Dependencies combine
package, adapter, and request values. Duplicate keys across these sources fail the request.

The evaluator receives these arguments in order:

- **`blocks`** - `RenderedBlockShape<TBlocks>`. The step's block arrangement, with each
  block replaced by its rendered wrapper.
- **`props`** - `RendererProps<TProps>`. Resolved values from the renderer invocation.
- **`context`** - `TContext`. The current step, journey state, and visible validation failures.

The evaluator returns the page output. An async evaluator is supported. All child blocks
render before the evaluator runs.
:::

:::param
---
name: blocksSchema
type: ZodType<TBlocks>
required: false
---
Validates the step's authored `blocks` structure at registration. Compose Zod arrays and
objects with `blockSchema` at positions containing blocks.

When omitted, this renderer adds no layout-schema check. Without any custom renderer,
steps accept the default array of blocks. Schema validation does not transform the layout
or insert Zod defaults into it.
:::

:::param
---
name: prepare
type: "(props: ResolvableProps<TProps>) => ResolvableProps<TProps>"
required: false
---
Adjusts renderer props each time its builder is called. When omitted, authored props pass
through unchanged. The callback runs before expressions resolve and receives neither
dependencies nor request state. It does not receive the step's blocks.
:::

#### Type parameters

| Parameter | Meaning |
|---|---|
| `TProps` | Plain renderer configuration. The builder accepts expressions for those values. |
| `TBlocks` | The authored block arrangement. Can be inferred from `blocksSchema`. |
| `TContext` | The renderer context type, extending `RendererFunctionContext`. |
| `TDeps` | Dependencies received by `factory`. Defaults to `Record<string, never>`. |

#### Returns

A callable `ForgeStepRenderer`. Calling it produces a `RendererInvocation` carrying its
props. The props argument is optional only when every authored prop is optional.

The invocation collects its renderer entry automatically when the package is created.
Name-only definitions can list the entry in the package's `functions`.

#### Caveats

- Journey renderers are inherited unchanged. A step's own renderer replaces the inherited
  invocation completely; their props are not merged.

- A step renderer provides the final page output instead of calling the adapter's default
  `assemblePage()`. The adapter still supplies nested-output wrapping and writes the response.

- Without an adapter `ForgeRenderer`, evaluation returns resolved data without running the
  rendering phase. An authored renderer invocation alone does not enable output in tests.

### The context object

The evaluator's third argument is a `RendererFunctionContext`. It provides the page
configuration, navigation structure, validation
failures, and request values used to assemble the page.

All properties below are present. The context exposes values for rendering, with no
methods for updating answers or request state.

#### Properties

:::param
---
name: kind
type: "'step'"
required: true
---
Identifies the context as a step render. Its value is always `'step'`.
:::

:::param
---
name: step
type: "RendererFunctionContext['step']"
required: true
---
The current step's resolved configuration. Hooks, blocks, and the renderer invocation
are excluded. Rendered blocks arrive separately as the evaluator's first argument.

| Property | Type | Description |
|---|---|---|
| `path` | `string` | The step's path. |
| `title` | `string` (optional) | The resolved page title. |
| `view` | `ViewConfig` (optional) | The effective template and locals, including inherited journey values. |
| `backlink` | `string` (optional) | The authored backlink, or a computed previous route when available. |
| `metadata` | `Record<string, unknown>` (optional) | Resolved metadata authored on the step. |

`view.template` uses the nearest configured template. `view.locals` merges from the
outermost journey to the step, with later values replacing earlier keys.
The custom renderer decides how to use this configuration when assembling output.
:::

:::param
---
name: ancestors
type: "RendererFunctionContext['ancestors']"
required: true
---
The containing journeys, ordered from the root to the immediate parent. Each entry
contains `code` and `path`, plus optional `title`, `view`, and `metadata`.

Entries carry resolved journey configuration, with the renderer invocation removed.
Use them for journey titles, breadcrumbs, or metadata attached to a containing journey.
:::

:::param
---
name: routeTree
type: "RendererFunctionContext['routeTree']"
required: true
---
An array of route nodes describing the journey's navigation hierarchy. Request parameters
are applied to paths, and active state reflects the current request.

| Node property | Type | Description |
|---|---|---|
| `segment` | `string` | The node's path segment. |
| `path` | `string` | The path with request parameters applied. |
| `templatePath` | `string` | The route template before parameter substitution. |
| `active` | `boolean` | `true` for the current step and nodes containing it. |
| `metadata` | `Record<string, unknown>` (optional) | Metadata associated with the node. |
| `route` | `RouteTreeRoute` (optional) | The journey or step at this node. Intermediate path nodes can omit it. |
| `children` | `RouteTreeNode[]` | Child nodes, using the same structure. |

`route` contains `kind` (`'journey'` or `'step'`) and `nodeId`, plus optional `title`,
`description`, and `metadata`. Use the tree to build navigation with resolved links
and an indication of the current location.
:::

:::param
---
name: showValidationFailures
type: boolean
required: true
---
Whether validation ran for the current page and its failures are available for display.
This can be `true` when validation passed and both error arrays are empty.

When `false`, both error arrays are empty. Check the arrays for failures when deciding
whether to render an error summary.
:::

:::param
---
name: fieldValidationErrors
type: "RendererFunctionContext['fieldValidationErrors']"
required: true
---
Visible failures from field validation, as an array of `RenderValidationError` objects.
Each entry describes one failed rule, so a field can have several entries.

| Property | Type | Description |
|---|---|---|
| `passed` | `boolean` | `false` for entries in this array. |
| `message` | `string` | The resolved validation message. |
| `submissionOnly` | `boolean` | Whether the rule runs only on submission. |
| `groups` | `string[]` | The rule's validation groups. |
| `details` | `Record<string, unknown>` (optional) | Additional details attached to the result. |
| `blockCode` | `string` (optional) | The field's answer code. |
| `anchor` | `string` (optional) | The failing field instance's document anchor. |

Use `message` for summary text and `anchor`, when present, for a link to the field.
Several field instances can share an answer code, so `blockCode` alone does not identify
the failing instance.
:::

:::param
---
name: domainValidationErrors
type: "RendererFunctionContext['domainValidationErrors']"
required: true
---
Visible failures from step-level validation, as an array of `ValidationResult` objects.

| Property | Type | Description |
|---|---|---|
| `passed` | `boolean` | `false` for entries in this array. |
| `message` | `string` | The resolved validation message. |
| `submissionOnly` | `boolean` | Whether the rule runs only on submission. |
| `groups` | `string[]` | The rule's validation groups. |
| `details` | `Record<string, unknown>` (optional) | Additional details attached to the result. |
| `blockCode` | `string` (optional) | The block code associated with the result, when present. |

Use these messages for failures involving the wider form, such as a check across
several answers. The array is empty when no domain failures are visible.
:::

:::param
---
name: answers
type: "Record<string, unknown>"
required: true
---
Current answers after parsing and preparation, keyed by field code. These are the
request's current values, including changes made by hooks. An absent key reads as
`undefined`.
:::

:::param
---
name: data
type: "Record<string, unknown>"
required: true
---
Data loaded for the current request, keyed by name. Values written by effects through
`context.setData()` are available here. An absent key reads as `undefined`.
:::

:::param
---
name: requestState
type: "Record<string, unknown>"
required: true
---
Adapter-managed values attached to the request, such as a CSRF token. Available keys
depend on the adapter and application. An absent key reads as `undefined`.
:::

---

## Usage

### Assemble named page regions

A renderer can accept a structured object instead of the default block array:

```typescript
import { HtmlBlock } from '@ministryofjustice/hmpps-forge/core/components'
import { journey, step } from '@ministryofjustice/hmpps-forge/core/authoring'

// Define the renderer
const TwoColumnPage = renderer('TwoColumnPage', {
  blocksSchema: z.object({
    main: z.array(blockSchema),
    sidebar: z.array(blockSchema),
  }),
  factory: () => blocks => {
    const main = blocks.main.map(block => block.html).join('')
    const sidebar = blocks.sidebar.map(block => block.html).join('')

    return `<main>${main}</main><aside>${sidebar}</aside>`
  },
})

// Use it in a step definition
const detailsStep = step({
  path: 'details',
  title: 'Details',
  renderer: TwoColumnPage(),
  blocks: {
    main: [HtmlBlock({ content: '<p>Application details</p>' })],
    sidebar: [HtmlBlock({ content: '<p>Help with your application</p>' })],
  },
})
```

Registration checks both regions against `blocksSchema`. At render time, the object keeps
its region names and arrays, while each block becomes a rendered wrapper.

### Pass renderer props and dependencies

Declare plain props for configuration and pass expressions when placing the renderer:

```typescript
import type nunjucks from 'nunjucks'
import type {
  BlockDefinition,
  RendererFunctionContext,
} from '@ministryofjustice/hmpps-forge/core/components'
import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'

// Define the renderer and its types
interface PageProps {
  heading: string
}

interface PageDeps {
  nunjucksEnv: nunjucks.Environment
}

const TemplatePage = renderer<PageProps, BlockDefinition[], RendererFunctionContext, PageDeps>(
  'TemplatePage',
  {
    blocksSchema: z.array(blockSchema),
    factory: ({ nunjucksEnv }) => (blocks, props, context) =>
      nunjucksEnv.render('pages/application.njk', { blocks, ...props, context }),
  },
)

// Use it in a definition
const pageRenderer = TemplatePage({ heading: Data('pageHeading') })
```

The template receives rendered children, the resolved heading, and the renderer context.
For HTML output, each child carries `{ block, html }`.

### Set a journey default

A journey can select a renderer for its descendant steps:

```typescript
journey({
  code: 'application',
  title: 'Application',
  path: '/application',
  renderer: Page(),
  steps: [detailsStep],
})
```

`detailsStep` keeps its explicit `TwoColumnPage()` renderer. Steps without an override
inherit `Page()` and must match its block schema.

---

## Troubleshooting

### Registration reports a renderer block schema error

The step's `blocks` value does not match its effective renderer's `blocksSchema`. Check
required regions and their types, including schemas inherited from a journey renderer.

### My renderer receives objects instead of HTML strings

Children are rendered wrappers, not bare strings. Read `block.html` for HTML output.
The wrapper also carries the child's authored block data.

### My renderer never runs in a test

A `ForgeTestHarness` client without a renderer returns resolved data only. Pass an adapter
`ForgeRenderer` to `createClient()` to enable rendering, plus any required adapter dependencies.

### My page template is no longer used

An explicit step renderer replaces default page assembly. If the output needs a template,
the renderer's evaluator must call it. The effective view remains available on `context.step`.
