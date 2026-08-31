---
title: Building Components
section: packages
path: packages/express-nunjucks/building-components
teaches: [nunjucksComponent, plain-component-props, component-rendering, validation-errors]
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

interface MyInputProps {
  id?: string
  label: string
}

export const MyInput = nunjucksComponent<MyInputProps>('my-input', {
  field: true,
  factory:
    ({ nunjucksEnv }) =>
    props =>
      nunjucksEnv.render('components/my-input.njk', {
        params: {
          id: props.id ?? props.code,
          name: props.code,
          label: { text: props.label },
          value: props.value,
          errorMessage: props.errors?.[0]
            ? { text: props.errors[0].message }
            : undefined,
        },
      }),
})
```

The component is built in two stages:

1. **`factory` receives the dependencies.** These include `nunjucksEnv`
   from the adapter and any dependencies registered with the package.
2. **The evaluator receives the resolved props.** The plain interface supplied as
   the generic parameter shapes those props; fields also receive `code`, `value`,
   and `errors` from Forge.

The evaluator must return an HTML string, either directly or through a promise.

Because the factory receives package dependencies, a component can load the data it
needs instead of requiring every caller to supply fully prepared display props. For
example, a case summary can accept only a reference:

```typescript
interface CaseSummaryProps {
  caseReference: string
}

interface CaseSummaryDependencies {
  cases: CaseService
}

export const CaseSummary = nunjucksComponent<CaseSummaryProps, CaseSummaryDependencies>(
  'case-summary',
  {
    factory:
      ({ cases, nunjucksEnv }) =>
      async props => {
        const summary = await cases.getSummary(props.caseReference)

        return nunjucksEnv.render('components/case-summary.njk', { params: summary })
      },
  },
)
```

This keeps loading and fallback behaviour with the component that understands it.
Forge evaluates independent components concurrently, so components on the same page
can make independent data calls in parallel.

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

Components are always scoped to the package that registers them.
To share one across journeys, use it in each journey - the same
handle registers wherever it is used.

---

## Validation errors

When a form is submitted and validation fails, the engine
collects the failed results from each field's `validWhen`
validations and attaches them as an `errors` array on the
field's render props:

```typescript
// Each error has a message and optional details
props.errors
// [{ message: 'Enter a valid date', details?: { ... } }]
```

Components check this array to render inline error messages
alongside form fields. When any field on the step has failed,
every field carries `errors` - its own failures, or an empty
array if it passed. When nothing failed, or the step has not
been submitted yet, the `errors` property is absent, so read
it defensively (`props.errors?.[0]`).

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
