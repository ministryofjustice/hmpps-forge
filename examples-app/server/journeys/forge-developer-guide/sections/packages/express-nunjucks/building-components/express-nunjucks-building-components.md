---
title: Building Components
section: packages
path: packages/express-nunjucks/building-components
teaches: [buildNunjucksComponent, NunjucksComponentRenderer, component-rendering, validation-errors]
prerequisites: [express-nunjucks, block]
---

<p class="govuk-caption-xl">Express-Nunjucks Adapter</p>

# Building Components
The `buildNunjucksComponent` utility creates a component that
renders a block using a Nunjucks template. This is how the
GOV.UK and MOJ component packages define their components, and
how you can build your own.

{{slot:toc}}

---

## Creating a component

A Nunjucks component maps a block variant to a render function
that returns HTML:

```typescript
import { buildNunjucksComponent } from '@ministryofjustice/hmpps-forge/express-nunjucks'
import type { MyInputDefinition } from './types'

export const myInput = buildNunjucksComponent<MyInputDefinition>(
  'my-input',
  (block, nunjucksEnv) => {
    return nunjucksEnv.render('components/my-input.njk', {
      params: {
        id: block.id,
        name: block.name,
        label: { text: block.label },
        value: block.value,
        errorMessage: block.errors?.[0]
          ? { text: block.errors[0].message }
          : undefined,
      },
    })
  },
)
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

Register your component with Forge so it can render blocks
that use the matching variant:

```typescript
import { createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { myInput } from './components/myInput'

export const myComponentPackage = createForgePackage({
  components: [myInput],
})

// Then register the package with Forge
forge.registerGlobalComponents(myComponentPackage)
```

---

## Validation errors

When a form is submitted and validation fails, the adapter
extracts failed validation results from the block's
`validWhen` property and passes them as an `errors` array on
the evaluated block:

```typescript
// Each error has a message and optional details
block.errors
// [{ message: 'Enter a valid date', details?: { ... } }]
```

Components check this array to render inline error messages
alongside form fields. The `errors` array is empty when there
are no validation failures, or when the step has not been
submitted yet.

Only errors where the validation's `passed` property is
`false` are included - passing validations are filtered out.

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
