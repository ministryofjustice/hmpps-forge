---
title: How blocks, resolution, and rendering connect
slug: how-blocks-resolution-and-rendering-connect
section: concepts
path: concepts/how-blocks-resolution-and-rendering-connect
nav: Pages and rendering
order: 18
description:
  How blocks, components, resolution, and rendering turn a journey definition into page
  output
teaches:
  [
    blocks,
    fields,
    components,
    variants,
    nested-blocks,
    field-components,
    rendering,
    render-context,
    route-tree,
    resolved-blocks,
    validation-errors,
    renderer-boundary,
  ]
prerequisites: [how-answers-work, how-validation-works]
related:
  concept:
    [
      working-with-repeated-data,
      how-answers-work,
      how-expressions-work,
      returning-a-page-redirect-or-error,
    ]
  reference: [block, field, component, renderer, journey, step]
---

# How blocks, resolution, and rendering connect

A Forge page is a tree of authored blocks. Each block is data, not output. A component
turns that data into framework output. Before that happens, the engine resolves
expressions, attaches values, and applies visibility. That split lets the same journey
definition produce output in any framework.

## Blocks describe the page

Blocks carry content, field definitions, and layout. The journey definition describes what
the page contains, while the application decides how each block becomes output.

A content block pairs text with a component:

```ts
Markdown({
  content: "Use this service to apply for a licence.",
});
```

A field block describes both page content and answer behaviour:

```ts
GovUKTextInput({
  code: "emailAddress",
  label: "Email address",
  hint: "We will use this to contact you about the application.",
});
```

Both are blocks. The field also creates an answer because it has a field code and
participates in answer preparation, validation, and rendering.

## A component is both the builder and the renderer

Each block has a variant. Forge uses that variant to find the registered component that can
render it.

A `component()` declaration yields one value that is simultaneously the function you call
to author a block and the registry entry that renders it. `GovUKTextInput` is not a thin
wrapper around a separately registered component. It *is* the component. Building a block
stamps the component onto it, so it self-registers.

```ts
// One declaration, two roles:
// 1. GovUKTextInput({ code, label }) builds the block (authoring)
// 2. The same object is the component entry (rendering)
const GovUKTextInput = component("govuk-text-input", {
  field: true,
  factory: () => (props) => `<input value="${props.value ?? ""}" />`,
});
```

The variant string (`"govuk-text-input"`) is the key that reconnects authoring to
rendering. At render time, Forge looks up the variant in the function registry and calls
that entry's evaluator. Authors don't write the string directly, because calling the component
function creates the right block shape and registers the component in one step. The string
exists so that a stored block can find its renderer again.

## Resolution turns authored blocks into renderable data

Before a component renders, Forge resolves block properties in a dedicated phase.

During that phase, Forge evaluates expression properties, attaches each field's current
value, and adds the validation errors visible for this request. When
a block contains nested blocks, the same resolution applies to them too.

The resolved block is still data:

```ts
GovUKTextInput({
  code: "emailAddress",
  label: Format("Email address for %1", Data("person.fullName")),
});
```

At render time, the component receives a label value, not the expression that created it.
This keeps renderer code simple: it renders values.

For a field block, the resolved data can include the field code, the current value, visible
validation errors, and component props such as labels, hints, and items.

The component doesn't prepare answers or run validation. Forge already did that work. The
component's job is to turn evaluated data into output.

## The render context

Resolution produces a render context: the full set of resolved data the renderer needs.
That context carries step and journey metadata, the route tree, resolved blocks, current
answers, loaded data, and only the validation errors visible for this request.

That context is adapter-friendly. The application can render it with whatever technology it
uses.

When no adapter renderer is supplied, Forge returns the render context as-is. Tests, adapters, and
tooling can inspect the resolved page without producing final markup.

## Validation display is part of the render context

Forge can know that a step is invalid without showing errors.

The render context contains only the errors that are visible for this request. Those errors
come from entry validation on a `GET` or submit validation on a `POST`.

Field errors attach to the resolved field block, while step-level errors attach to the
page-level validation state. Because several blocks can share one field code, errors are
grouped by render-block id rather than by code.

The renderer doesn't decide whether to show an error. The journey decides that earlier
through entry and submit behaviour. The render context records that decision as a boolean:
when `showValidationFailures` is true, validation ran and the errors are ready
to display.

## Nested blocks render bottom-up

Some blocks accept other blocks as props: a layout with a `content` slot, a summary that
renders one block per row, or a conditional panel that wraps child blocks.

Forge renders these nested blocks before the parent component receives them. The parent gets
rendered child output paired with the child's block data, so it can arrange that output
without knowing how to render each child itself.

A parent component can place child output directly, or it can wrap, group, or restructure
it. For example, a component can inject attributes around child blocks, group them into a
fieldset, or reshape the HTML around a repeated set of children.

A parent that restructures child output still preserves the authored meaning of the child
blocks. The child block data travels with the rendered output for exactly this reason.

## A step renderer assembles the page

After the components render, a step renderer can arrange their output into a complete
page. A `renderer()` declaration receives the rendered blocks, its resolved props, and
context containing the current step, navigation, answers, data, and visible validation
failures. Its block layout can be an array or a structured arrangement of named regions.

A journey can select a renderer for its steps, and a step can replace that inherited
renderer with its own. When one is selected, it produces the page output. Otherwise,
the adapter's renderer assembles the page. The adapter wraps nested output and writes
the response in both cases.

## Visibility is display, not data

Blocks can use `visibleWhen` to appear only in some request states:

```ts
GovUKTextInput({
  code: "emailAddress",
  label: "Email address",
  visibleWhen: Answer("contactMethod").match(Condition.Equals("email")),
});
```

`visibleWhen` is evaluated during resolution. When the condition is false, the engine
produces empty output for that block before the component or renderer is ever called. The
block stays in the render context with its position preserved, but the output is empty.

Visibility doesn't clear answers, skip validation, or remove a field from the journey
model, so a hidden field's answer can still exist. Visibility controls what the user sees,
while other mechanisms (`dependentWhen`, reachability, cleardown) control what the data
model keeps.

## The render context serves any output format

Because the render context is data, a renderer can turn it into HTML, React nodes, Nunjucks
output, or another format. Forge owns the journey evaluation and the render context. The
renderer owns the output format.
