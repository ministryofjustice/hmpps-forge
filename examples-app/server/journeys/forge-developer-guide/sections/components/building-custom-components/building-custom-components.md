---
title: Custom components
section: building-functions-and-components
path: building-functions-and-components/custom-components
teaches: [buildComponent, buildNunjucksComponent, ComponentRenderer, EvaluatedBlock, RenderedBlock, custom-component-variant, field-value, field-errors]
prerequisites: [block, field, BlockDefinition, FieldBlockProps, createForgePackage]
---

<p class="govuk-caption-xl">Components</p>

# Building custom components

Blocks are the declarative objects you author in a journey. Components
are the renderers that turn those blocks into HTML. Forge ships with
components for the GOV.UK and MOJ design systems, plus a small core set
(`HtmlBlock`, `CollectionBlock`, `TemplateWrapper`). When your service
needs a visual that the built-in set does not cover, you can define
your own component and register it alongside your journey.

{{slot:toc}}

---

## Blocks and components

A block definition is data. A component is the function that renders
that data. The two are linked by a `variant` string: the block sets
`variant: 'myCard'` and the component registers itself with the same
variant, so Forge knows which renderer to call.

```
block:       { variant: 'myCard', heading: 'Title', ... }
                                      |
                             variant lookup
                                      v
component:   render(block) -> '<div class="my-card">...</div>'
```

By the time a component is called, every expression in the block has
already been resolved. `Answer('name')` has become the string the
user typed. `visibleWhen` has been evaluated (and the block would
have been filtered out if it returned false). Nested blocks have
been pre-rendered to HTML. The component only sees concrete values.

---

## The props interface

Every custom component starts with a props interface. This is the
public API that journey definitions use, and the type that shapes the
factory function.

Extend `BasicBlockProps` for a display component, or `FieldBlockProps`
for one that captures user input:

```typescript
import type {
  BasicBlockProps,
  ResolvableString,
  ResolvableBoolean,
} from '@ministryofjustice/hmpps-forge/core/components'

export interface MyCardProps extends BasicBlockProps {
  /** The card's heading. */
  heading: ResolvableString
  /** Body text shown below the heading. */
  content?: ResolvableString
  /** Whether to show a subtle border. */
  outlined?: ResolvableBoolean
}
```

Use the `Resolvable*` types for any prop that should accept
expressions from the authoring language. `ResolvableString` accepts
a plain string, an `Answer()` or `Data()` reference, a `Format()`
expression, a pipeline, or any other expression that resolves to a
string. The same pattern applies to `ResolvableBoolean`,
`ResolvableNumber`, and `ResolvableArray<T>`.

Properties that should stay static (an inline `attributes` record,
for example) can use plain TypeScript types.

---

## The block definition and factory

Pair the props with a block interface that fixes the `variant`, and
expose a factory function so authors do not have to set the variant
themselves.

For a display block:

```typescript
import {
  block as buildBlock,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import type { BlockDefinition } from '@ministryofjustice/hmpps-forge/core/components'

export interface MyCard extends BlockDefinition, MyCardProps {
  variant: 'myCard'
}

export function MyCard(props: MyCardProps): MyCard {
  return buildBlock<MyCard>({ ...props, variant: 'myCard' })
}
```

For a field block, use `field` instead of `block` and extend
`FieldBlockDefinition`. Field blocks gain a `code`, validation, and
the runtime `value`/`errors` state described below.

```typescript
import { field as buildField } from '@ministryofjustice/hmpps-forge/core/authoring'
import type { FieldBlockDefinition } from '@ministryofjustice/hmpps-forge/core/components'

export interface MyStarRating extends FieldBlockDefinition, MyStarRatingProps {
  variant: 'myStarRating'
}

export function MyStarRating(props: MyStarRatingProps): MyStarRating {
  return buildField<MyStarRating>({ ...props, variant: 'myStarRating' })
}
```

---

## The renderer

A component's renderer is a function that receives the evaluated
block and returns an HTML string. Forge provides two builders,
depending on how you want to produce HTML.

### Pure function components

`buildComponent` is the simpler of the two. The render function
takes the evaluated block and returns HTML. Use this when the output
is short, self-contained, and does not need a template engine.

```typescript
import { buildComponent } from '@ministryofjustice/hmpps-forge/core/components'

export const myCard = buildComponent<MyCard>('myCard', block => {
  const border = block.outlined ? ' my-card--outlined' : ''

  return `
    <div class="my-card${border}">
      <h2 class="govuk-heading-m">${block.heading}</h2>
      ${block.content ? `<p class="govuk-body">${block.content}</p>` : ''}
    </div>
  `
})
```

The `variant` string passed to `buildComponent` must match the
`variant` set on the block. That is how Forge finds the right
renderer at runtime.

### Template-based components

`buildNunjucksComponent` (from `@ministryofjustice/hmpps-forge/express-nunjucks`)
is the right choice when you want to render through a Nunjucks
template. The render function receives the evaluated block and a
Nunjucks environment supplied by Forge.

```typescript
import { buildNunjucksComponent } from '@ministryofjustice/hmpps-forge/express-nunjucks'

export const myCard = buildNunjucksComponent<MyCard>('myCard', (block, nunjucksEnv) => {
  const params = {
    heading: block.heading,
    content: block.content,
    outlined: block.outlined,
  }

  return nunjucksEnv.render('components/my-card/template.njk', { params })
})
```

The built-in GOV.UK and MOJ components follow this pattern. Each one
extracts a `params` object from the evaluated block, then hands that
to the matching design-system template. Your own Nunjucks components
should do the same: keep the renderer thin, and let the template
deal with markup.

---

## What the evaluated block contains

The block passed to your renderer is an `EvaluatedBlock`. The
important points:

- **All `Resolvable*` props are resolved values.** If your prop type
  was `ResolvableString`, `block.heading` is now a plain `string`.
  There is no expression object to evaluate.
- **Props omitted in the definition are `undefined`.** Guard before
  reading them, especially for optional content.
- **Field blocks gain `value` and `errors`.** `block.value` is the
  current answer, resolved from submission, `defaultValue`, or a
  loaded answer store. `block.errors` is an array of
  `{ message, details? }` populated when validation has run and
  failed. Both can be `undefined`.
- **Nested block props arrive as `RenderedBlock` objects.** If your
  props accept an array of blocks (for slots or children), Forge
  has already rendered them before your component runs. Each entry
  is `{ block, html }`. Concatenate `.html` values to place them in
  your output. Your renderer never calls the rendering pipeline
  itself.

```typescript
import type { RenderedBlock } from '@ministryofjustice/hmpps-forge/core/components'

const renderChildren = (children: RenderedBlock[] | undefined): string => {
  return (children ?? []).map(child => child.html).join('')
}
```

---

## Field blocks: value and errors

Field components use `block.value` and `block.errors` to drive their
output. The GOV.UK text input is a compact example:

```typescript
export const govukTextInput = buildNunjucksComponent<GovUKTextInput>(
  'govukTextInput',
  (block, nunjucksEnv) => {
    const params = {
      id: block.id ?? block.code,
      name: block.code,
      label: typeof block.label === 'object' ? block.label : { text: block.label },
      value: block.value,
      errorMessage: block.errors?.length && { text: block.errors[0].message },
    }

    return nunjucksEnv.render('govuk/components/input/template.njk', { params })
  },
)
```

A few things to copy from this pattern:

- **Use `block.code` for the `name` attribute.** The code is the
  field's identity in the answer store. A POST with
  `name="email"` is what flows back into `Answer('email')`.
- **Default the `id` to the code.** Authors can override it for
  legitimate cases (for example, two fields sharing a name), but the
  common case is `id === code`.
- **Render the first error.** `block.errors` is ordered. Most
  design systems only display one message at a time.

---

## Composite fields: multiple inputs, one value

A field block does not have to map to a single HTML input. A date
input renders three boxes for day, month and year but stores one
answer. A price input might render a currency dropdown alongside a
number box. A quantity input might pair a value with a unit selector.
The pattern that makes this work is the same in every case, and it
uses standard HTTP form behaviour rather than a Forge-specific
mechanism.

### The submission path

Emit each sub-input with a bracketed `name` attribute built from the
field's `code`:

```typescript
<input name="${block.code}[day]"   value="${parts.day ?? ''}" />
<input name="${block.code}[month]" value="${parts.month ?? ''}" />
<input name="${block.code}[year]"  value="${parts.year ?? ''}" />
```

When the form is submitted, the Express body parser expands the
bracket notation into a nested object. All three inputs arrive under
the field's single `code` as
`{ day: '31', month: '3', year: '1980' }`. From Forge's point of view,
this is one answer whose value happens to be an object.

A formatter then reshapes the object into the canonical form that the
rest of the definition will see. The built-in date inputs pair with
`Transformer.Object.ToISO` to collapse the three parts into an ISO
date string before validation runs:

```typescript
GovUKDateInputFull({
  code: 'dateOfBirth',
  label: { text: 'Date of birth' },
  formatters: [
    Transformer.Object.ToISO({ year: 'year', month: 'month', day: 'day' }),
  ],
})
```

By the time `validWhen` evaluates `Self()`, the stored answer is the
string `'1980-03-31'`. Other pages see that same ISO string through
`Answer('dateOfBirth')`. The three-input structure is invisible
outside the component.

### The render path

On render, `block.value` is already in the shape the component
expects. The field's `parsers` convert the stored ISO string back to
an object with date parts before the component sees it. On POST
(validation failure re-render), `block.value` is the raw submitted
object. Either way, the component receives an object:

```typescript
const parts = (block.value as { day?: string; month?: string; year?: string } | undefined) ?? {}

const items = [
  { name: `${block.code}[day]`,   value: parts.day },
  { name: `${block.code}[month]`, value: parts.month },
  { name: `${block.code}[year]`,  value: parts.year },
]
```

The built-in `GovUKDateInputFull` wrapper adds both a formatter
(`Transformer.Object.ToISO`) and a parser (`Transformer.Object.FromISO`)
automatically. If you are building a custom multi-part component, add
the appropriate formatter and parser to the wrapper function so authors
do not need to specify them manually.

### Per-part error styling

When a composite field fails validation, it is often useful to
highlight only the specific input that caused the failure. Validation
rules pass this hint through `details`:

```typescript
validation({
  condition: not(
    and(
      Self().match(Condition.Object.IsObject()),
      Self().not.match(Condition.Object.PropertyHasValue('day')),
    ),
  ),
  message: 'Date must include a day',
  details: { field: 'day' },
})
```

Forge does not interpret `details`. It forwards the object verbatim to
the component through `block.errors[0].details`. The component
decides what to do with it. The GOV.UK date input uses it to apply an
error class to one input while leaving the others alone, and falls
back to highlighting all inputs when `details.field` is absent:

```typescript
const errorDetails = block.errors?.[0]?.details
const hasError = Boolean(block.errors?.length)

const classForField = (fieldName: string) => {
  if (!hasError) return undefined
  if (!errorDetails?.field) return 'govuk-input--error'
  return errorDetails.field === fieldName ? 'govuk-input--error' : undefined
}
```

### When to reach for this pattern

Composite fields make sense when several inputs represent parts of a
single conceptual value. Date parts, address parts, price with
currency, quantity with unit. The test is whether the answer makes
sense as a single `Answer()` reference elsewhere in the definition.
If each part needs to be read, validated and displayed independently,
they are better modelled as separate fields.

---

## Escaping and XSS

Nunjucks autoescapes variables by default, so template-based
components inherit sensible output handling. Pure-function
components are on the hook themselves: any value you interpolate
into HTML could have come from user input or external data, and
must be escaped before it reaches the markup.

Forge does not export an escaping helper, so define a small one
alongside your component. Authors can also apply
`Transformer.String.EscapeHtml()` in the definition.

```typescript
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export const myBadge = buildComponent<MyBadge>('myBadge', block => {
  const label = escapeHtml(String(block.label ?? ''))

  return `<span class="my-badge">${label}</span>`
})
```

Attributes need the same treatment. When building a class or data
attribute from a dynamic prop, escape both the key and the value.

---

## Registration

Components are registered through the `components` array on
`createForgePackage`:

```typescript
import { createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { myCard } from './components/myCard'
import { myBadge } from './components/myBadge'

export default createForgePackage({
  journey: myJourney,
  components: [myCard, myBadge],
})
```

Components registered through a package are scoped to that journey.
To make a component available to every journey in the application,
use `forge.registerGlobalComponents()` instead. This is how the
GOV.UK and MOJ component packages expose their built-ins.

---

## Using custom components

Once registered, a custom component is used like any built-in:

```typescript
import { MyCard } from './components/myCard'

GovUKInsetText({ text: 'Welcome back.' })

MyCard({
  heading: Format('Hello, %1', Answer('firstName')),
  content: Data('user.bio'),
  outlined: true,
})
```

Because the props accept `Resolvable*` types, authors can pass
expressions wherever the type allows. Forge resolves them before
calling the renderer.

---

## Testing

Renderers are plain functions. Call them with a hand-crafted
evaluated block and assert on the returned HTML. Pure-function
components need no framework setup:

```typescript
import { myCard } from './myCard'
import type { EvaluatedBlock } from '@ministryofjustice/hmpps-forge/core/components'

describe('myCard', () => {
  describe('render()', () => {
    it('should include the heading text', () => {
      // Arrange
      const block = {
        variant: 'myCard',
        heading: 'Hello',
        content: 'Body text',
        outlined: false,
      } as unknown as EvaluatedBlock<MyCard>

      // Act
      const html = myCard.render(block)

      // Assert
      expect(html).toContain('Hello')
      expect(html).toContain('Body text')
    })
  })
})
```

For a `buildNunjucksComponent` renderer, pass a stub with a
`render` method to assert on the template path and params:

```typescript
it('should pass heading to the template', () => {
  // Arrange
  const nunjucksEnv = { render: jest.fn().mockReturnValue('<div></div>') }

  const block = {
    variant: 'myCard',
    heading: 'Hello',
  } as unknown as EvaluatedBlock<MyCard>

  // Act
  myCard.render(block, nunjucksEnv)

  // Assert
  expect(nunjucksEnv.render).toHaveBeenCalledWith(
    'components/my-card/template.njk',
    { params: expect.objectContaining({ heading: 'Hello' }) },
  )
})
```

For field components, include `value` and `errors` in the test
block to exercise populated and error states separately.

---

## Best practices

- **Use `Resolvable*` types for props that should accept
  expressions.** Plain string, boolean, number, and array types
  prevent authors from passing `Answer()`, `Data()`, or pipelines,
  which is almost never what you want for display properties.
- **Keep renderers thin.** A renderer pulls values off the
  evaluated block and hands them to a template or a short HTML
  string. Move logic that belongs in the authoring layer
  (conditions, formatting) into the definition instead.
- **Escape all dynamic values in pure-function components.** Nunjucks
  templates autoescape; raw strings do not. Escape both attribute
  values and text interpolated into markup.
- **Default `id` to `code` on field components.** The code is the
  canonical identity. Authors can override the id for edge cases
  but should not need to in the common case.
- **Render nested blocks by concatenating their `.html`.** Blocks
  passed as props arrive pre-rendered as `RenderedBlock` objects.
  Your component never runs the pipeline itself.
- **For composite fields, pair the renderer with a formatter.** Use
  bracketed input names so the body parser combines the parts into a
  single object, then collapse the object into a canonical form with
  a formatter like `Transformer.Object.ToISO` before validation runs.
- **Scope components through the package by default.** Register
  globally only when a component is genuinely shared across every
  journey in the application.
