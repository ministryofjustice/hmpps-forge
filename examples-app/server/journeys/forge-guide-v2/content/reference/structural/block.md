---
title: block()
slug: block
section: reference
path: reference/block
nav: Authoring API/Structural
order: 12
description: Creates a presentational block definition for a registered component
teaches: [block, variant, visibleWhen, metadata, component]
prerequisites: [step]
related:
  concept: how-blocks-resolution-and-rendering-connect
  reference: field, component
---

# `block()`

`block()` creates presentational content for a step. Unlike `field()`, it does not
create an answer or take part in answer preparation and validation.

Calling a presentational component creates this block definition:

```typescript
const applicationHeading = GovUKHeading({
  text: 'Apply for a licence',
  size: 'l',
})
```

---

## Reference

### `block(definition)`

Call `block()` to create a basic block definition. Its `variant` selects the registered
component that will render it; that component defines the props the block accepts.

[See more examples below.](#usage)

```typescript
function block<D extends BlockDefinition>(definition: Omit<D, '_forge'>): D
```

#### Parameters

:::param
---
name: definition
type: Omit<D, '_forge'>
required: true
---
An object describing content for one registered component. Its shared properties are
listed below. Add the props required by the component selected by `variant`.
:::

#### Definition properties

:::param
---
name: variant
type: string
required: true
---
The registered component to render this block, such as `'html'` or a variant supplied by
a GOV.UK, MOJ, or application component package. Forge validates that the variant
matches a registered component when it registers the package.

Calling a component sets its variant and carries its registration entry. See
[Call a component](#call-a-component).
:::

:::param
---
name: visibleWhen
type: ResolvableBoolean
required: false
---
Controls whether the block produces output for the current request. Accepts a boolean or
an expression, such as `Answer('contactMethod').match(Condition.Equals('email'))`. When
omitted, the block is visible.

[Learn how block visibility affects rendering.](../concepts/how-blocks-resolution-and-rendering-connect)
:::

:::param
---
name: metadata
type: Record<string, unknown>
required: false
---
Additional information for an application, such as `{ analyticsId: 'application-heading' }`.
Forge preserves this information on the resolved block but does not give it built-in
behaviour. A component or renderer can use it for analytics, debugging, or custom
processing.
:::

#### Returns

`block()` returns a presentational block definition. Add it to a step's `blocks` array or
pass it to a component prop that accepts nested blocks.

#### Caveats

- Blocks do not have author-defined identifiers. Forge uses the block's variant and its
  position in the definition for diagnostics and traces. If several blocks use the same
  variant, their authored position is the distinguishing context.

---

## Usage

### Call a component

A component is callable. Calling it creates a block definition with typed props
and carries the component's registration entry:

```typescript
const heading = GovUKHeading({
  text: 'Your contact details',
  size: 'l',
})
```

`createForgePackage()` collects the entry from the journey automatically.

### Show content only when it applies

Set `visibleWhen` when the page can render a block only in some request states:

```typescript
const emailHelp = GovUKBody({
  classes: 'govuk-hint',
  text: 'We will use this to contact you about the application.',
  visibleWhen: Answer('contactMethod').match(Condition.Equals('email')),
})
```

Forge evaluates the condition for each request. When the contact method is not email,
the block remains part of the authored page but the renderer does not produce visible
output for it.

### Pass blocks into a component

Some components accept blocks as part of their own props. Forge resolves those child
blocks before the parent component receives them:

```typescript
const contactPanel = TemplateWrapper({
  template: '<section class="app-panel">{{slot:content}}</section>',
  slots: {
    content: [
      GovUKHeading({ text: 'Contact details', size: 'm' }),
      GovUKBody({ text: 'We will use these details to contact you.' }),
    ],
  },
})
```

`TemplateWrapper` receives the completed output of the heading and body
blocks, so it can place the content in its `content` slot without rendering the children
itself.

---

## Troubleshooting

### Forge reports an unregistered component variant

No component has been registered for the block's `variant`. Check the exact variant
string, then register the relevant component package or application component when Forge
is configured.

Calling the component carries its registration entry, which
`createForgePackage()` collects automatically.

### A block does not appear

Check `visibleWhen` first. Forge evaluates it against the current request state, so a
false condition prevents the block from producing output.

If the condition passes, check the selected component and renderer. Forge resolves the
block's props, but the registered component decides what output those props produce.
