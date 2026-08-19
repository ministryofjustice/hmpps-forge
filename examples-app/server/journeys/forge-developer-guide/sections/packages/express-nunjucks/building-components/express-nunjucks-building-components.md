---
title: Building Components
section: packages
path: packages/express-nunjucks/building-components
teaches: [nunjucksComponent, NunjucksComponentRenderer, component-rendering, validation-errors]
prerequisites: [express-nunjucks, block]
---

<p class="govuk-caption-xl">Express-Nunjucks Adapter</p>

# Building Components
The `nunjucksComponent` utility creates a component that
renders a block using a Nunjucks template. This is how the
GOV.UK and MOJ component packages define their components, and
how you can build your own.

{{slot:toc}}

---

## Creating a component

A Nunjucks component maps a block variant to a render function
that returns HTML. The result is also the block builder for
that variant - authors call it with props to build blocks:

```typescript
import { nunjucksComponent } from '@ministryofjustice/hmpps-forge/express-nunjucks'
import type { MyInputDefinition } from './types'

export const MyInput = nunjucksComponent<MyInputDefinition>('my-input', {
  field: true,
  render: (block, nunjucksEnv) => {
    return nunjucksEnv.render('components/my-input.njk', {
      params: {
        id: block.id ?? block.code,
        name: block.code,
        label: { text: block.label },
        value: block.value,
        errorMessage: block.errors?.[0]
          ? { text: block.errors[0].message }
          : undefined,
      },
    })
  },
})
```

The render function receives two arguments:

1. **`block`** - the evaluated block, with all expressions
   resolved to concrete values. Its type is
   `EvaluatedBlock<T>`, where `T` is the block definition type
   you provide as the generic parameter.
2. **`nunjucksEnv`** - the Nunjucks environment, backed by an
   internal template cache so repeated renders of the same
   template don't recompile.

The function must return an HTML string.

---

## Registering components

Building blocks with the component in a journey definition
registers it automatically - at `registerPackage()`, Forge
collects every component the journey's blocks were built with
and registers it for that package. There is nothing to list.

When a journey refers to the variant only by string - a JSON
journey, or blocks authored as plain objects - list the
component on the package's `components` property instead:

```typescript
import { createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { MyInput } from './components/myInput'

export const myPackage = createForgePackage({
  journey: myJourney,
  components: [MyInput],
})

forge.registerPackage(myPackage)
```

To make it available to every journey in the application, pass
it to `registerGlobalComponents`:

```typescript
import { MyInput } from './components/myInput'

forge.registerGlobalComponents([MyInput])
```

---

## Validation errors

When a form is submitted and validation fails, the engine
collects the failed results from each field's `validWhen`
validations and attaches them as an `errors` array on the
evaluated block:

```typescript
// Each error has a message and optional details
block.errors
// [{ message: 'Enter a valid date', details?: { ... } }]
```

Components check this array to render inline error messages
alongside form fields. When any field on the step has failed,
every field carries `errors` - its own failures, or an empty
array if it passed. When nothing failed, or the step has not
been submitted yet, the `errors` property is absent, so read
it defensively (`block.errors?.[0]`).

Only failed validations are included - passing validations
are filtered out.

---

## Nested blocks

Some components accept other blocks as properties (for
example, a grid layout that contains child blocks in each
column). When the adapter encounters a nested block inside a
component's properties, it renders that block to HTML
automatically and provides the result as a `RenderedBlock`:

```typescript
interface RenderedBlock {
  block: { type, blockType, variant, ...properties }
  html: string
}
```

Your component receives the pre-rendered HTML in `html` and
the block's metadata in `block`, so it can place the HTML in
the right location and optionally inspect the block's
properties for layout decisions.

Nested blocks with `visibleWhen` evaluating to `false` are
removed entirely - they won't appear in the rendered output.
