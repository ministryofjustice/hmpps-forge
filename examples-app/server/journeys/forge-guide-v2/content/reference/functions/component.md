---
title: component()
slug: component
section: reference
path: reference/component
nav: Authoring API/Functions
order: 34
description: Defines a component that builds blocks and renders their resolved props
teaches: [component, factory, prepare, field-components, inputSchema, multiple, errorAnchor]
prerequisites: []
related:
  concept: how-blocks-resolution-and-rendering-connect
  reference: renderer, block, field, create-forge-package, function-registry-test-harness
---

# `component()`

`component()` defines a component that builds [blocks](./block) and renders their resolved props.

```typescript
import { component } from '@ministryofjustice/hmpps-forge/core/components'

const Divider = component('Divider', {
  factory: () => () => '<hr class="govuk-section-break" />',
})

// In a step definition:
blocks: [Divider()]
```

---

## Reference

### `component(variant, options)`

Creates a named component. Calling it inside a journey builds a block and collects the
entry automatically when the package is created.

```typescript
function component<TProps extends object, TDeps = Record<string, never>>(
  variant: string,
  options: ComponentOptions<TProps, TDeps>,
): ForgeComponent<TProps, TDeps>

function component<TProps extends object, TDeps = Record<string, never>>(
  variant: string,
  options: FieldComponentOptions<TProps, TDeps>,
): ForgeFieldComponent<TProps, TDeps>
```

#### Parameters

:::param
---
name: variant
type: string
required: true
---
The component's registration name. The block builder records this name so rendering can
find its evaluator. There is no anonymous overload.
:::

:::param
---
name: options
type: ComponentOptions<TProps, TDeps> | FieldComponentOptions<TProps, TDeps>
required: true
---
The evaluator factory and optional authoring behaviour. Set `field: true` for a component
that collects an answer. Omit `field` for a presentational component.
:::

#### Options

:::param
---
name: factory
type: "(deps: TDeps) => (props) => unknown"
required: true
---
Builds the evaluator during context preparation for each request. Dependencies combine
package, adapter, and request values. Duplicate keys across these sources fail the request.

The evaluator receives resolved props. Expression values are already evaluated, and nested
blocks are replaced with their rendered output. An async evaluator is supported.

Basic components receive `ComponentRenderProps<TProps>`. Fields receive
`FieldComponentRenderProps<TProps>`, including `code`, `value`, and visible validation `errors`.
:::

:::param
---
name: prepare
type: "(props) => props"
required: false
---
Adjusts authored props each time the component builder is called. It receives
`BasicBlockProps & ResolvableProps<TProps>`, or `FieldBlockProps & ResolvableProps<TProps>`
for fields, and returns the same shape.

When omitted, authored props pass through unchanged. This callback runs while building the
definition, before expressions resolve. It receives neither dependencies nor request state.
:::

#### Field options

These options apply only to declarations with `field: true`.

:::param
---
name: field
type: "true"
required: true
---
Makes the component an answer-collecting field. Its builder requires a `code` and accepts
the shared [field properties](./field), including `validWhen`, `defaultValue`, and `dependentWhen`.
:::

:::param
---
name: inputSchema
type: ZodType
required: false
---
Validates the normalised submitted value before it is recorded or passed through formatters.
Invalid input becomes `undefined`, or `[]` when `multiple` is true.

Successful input is retained unchanged. Schema transforms do not replace the submitted
value. When omitted, no component input-schema check runs. This option does not validate
visual props or generate validation messages.
:::

:::param
---
name: multiple
type: boolean
required: false
---
Whether the field handles a list of answer values. Defaults to `false`. When true, a single
submitted value becomes a one-item array and an absent submission becomes `[]`.
:::

:::param
---
name: errorAnchor
type: "(props: FieldComponentRenderProps<TProps>) => string | undefined"
required: false
---
Chooses the element ID targeted by validation-summary links. When omitted, or when it
returns `undefined`, the field code is used. Return the ID of the rendered input when it
differs from the answer code.
:::

#### Type parameters

| Parameter | Meaning |
|---|---|
| `TProps` | The component's plain props, such as `{ text: string }`. Authoring accepts expressions automatically. |
| `TDeps` | Dependencies received by `factory`. Defaults to `Record<string, never>`. |

Props do not extend `BlockDefinition` or `FieldBlockDefinition`. The builder adds that
structure and the shared block or field properties.

#### Returns

A callable `ForgeComponent`, or `ForgeFieldComponent` for a field declaration. Calling it
produces a block definition. Rendering happens later during request evaluation.

The props argument is optional only when every authored prop is optional. A field still
requires `code`, even when its visual props are all optional.

#### Caveats

- `visibleWhen` controls display. It does not clear answers or replace field validation.

- Output must match the rendering stack. Nunjucks components return HTML strings.

- Embedded entries register automatically. For definitions using variant strings, list
  the entry in the package's `functions`. Explicitly listed names must be unique.

---

## Usage

### Render plain props with a template

Type the visual props with ordinary values. Expressions are accepted at the call site:

```typescript
import type nunjucks from 'nunjucks'
import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'

// Define the component and its types
interface NoticeProps {
  text: string
}

interface TemplateDeps {
  nunjucksEnv: nunjucks.Environment
}

const Notice = component<NoticeProps, TemplateDeps>('Notice', {
  factory: ({ nunjucksEnv }) => props =>
    nunjucksEnv.renderString('<p class="govuk-body">{{ text }}</p>', props),
})

// Use it in a definition
const noticeBlock = Notice({ text: Data('noticeText') })
```

The bundled Express adapter supplies its configured `nunjucksEnv` as an adapter dependency.
The evaluator receives a string for `text`, rather than the `Data()` expression.

### Render a field value and its errors

A field evaluator receives the prepared display value and the errors selected for display:

```typescript
import { z } from 'zod'

// Define the component and its types
interface ReferenceInputProps {
  label: string
}

const ReferenceInput = component<ReferenceInputProps, TemplateDeps>('ReferenceInput', {
  field: true,
  inputSchema: z.string(),
  factory: ({ nunjucksEnv }) => props =>
    nunjucksEnv.render('components/reference-input.njk', props),
})

// Use it in a definition
const referenceField = ReferenceInput({ code: 'reference', label: 'Reference number' })
```

The template receives `label`, `code`, `value`, and optional `errors`. Each error has a
`message` and optional `details`. Rules authored in `validWhen` determine those messages.

### Arrange nested blocks

Declare child content with `BlockDefinition` in the plain props:

```typescript
import type { BlockDefinition } from '@ministryofjustice/hmpps-forge/core/components'

// Define the component and its types
interface PanelProps {
  content: BlockDefinition[]
}

const Panel = component<PanelProps>('Panel', {
  factory: () => props =>
    `<section>${props.content.map(child => child.html).join('')}</section>`,
})

// Use it in a definition
const panelBlock = Panel({ content: [Divider()] })
```

Children render before their parent. HTML child results carry `{ block, html }`; the
`block` property retains their authored data. Other output formats depend on the adapter's
nested-output wrapper.

---

## Troubleshooting

### My factory receives missing dependencies

Check package, adapter, and request dependencies. They are merged before factories run.
For direct component tests, pass them to `FunctionRegistryTestHarness` explicitly.

### My input schema does not transform the answer

`inputSchema` checks submitted values without replacing them. Use the field's `formatters`
for answer transformations and `validWhen` for user-facing validation rules.

### My component receives an object instead of child HTML

Nested children arrive as rendered wrappers. Read `child.html` for HTML output instead of
interpolating the entire wrapper.

### Calling the component does not return markup

The call creates a block definition. Use `FunctionRegistryTestHarness.render()` to test
its output, or place the block in a journey rendered through an adapter.
