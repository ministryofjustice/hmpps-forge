---
title: Custom components
section: building-functions-and-components
path: building-functions-and-components/custom-components
teaches: [component, nunjucksComponent, ComponentTestHarness, plain-component-props, RenderedBlock, custom-component-variant, field-value, field-errors]
prerequisites: [block, field, createForgePackage]
---

<p class="govuk-caption-xl">Components</p>

# Building custom components

Blocks are the declarative objects you author in a journey. Components
are the renderers that turn those blocks into HTML. Forge ships with
components for the GOV.UK and MOJ design systems, plus a small core set
(`HtmlBlock`, `CollectionBlock`, `TemplateWrapper`). When your service
needs a visual that the built-in set does not cover, declare your own
with `component()` or a renderer-specific helper. Using it in a journey
registers it automatically.

{{slot:toc}}

---

## Blocks and components

A block definition is data. A component is the function that renders
that data. The two are linked by a `variant` string: every block the
component builds carries `variant: 'myCard'`, and the component is
registered under the same variant, so Forge knows which component to
call. One component declaration covers both sides: it returns the block
builder, and the same value is the component entry.

```
block:       { variant: 'myCard', heading: 'Title', ... }
                                      |
                             variant lookup
                                      v
component:   evaluate(block) -> '<div class="my-card">...</div>'
```

By the time a component is called, every expression in the block has
already been resolved. `Answer('name')` has become the string the
user typed. `visibleWhen` has been evaluated (and the block would
have been filtered out if it returned false). Nested blocks have
been pre-rendered to HTML. The component only sees concrete values.

---

## The props interface

Every custom component starts with an ordinary props interface. It describes
the concrete values the component implementation renders:

```typescript
export interface MyCardProps {
  /** The card's heading. */
  heading: string
  /** Body text shown below the heading. */
  content?: string
  /** Whether to show a subtle border. */
  outlined?: boolean
}
```

`component()` and the renderer-specific helpers derive the journey-authoring side
from this interface. A plain `string` prop therefore accepts either a string or
an expression that resolves to one when an author calls the component. The render
implementation still sees the original `string` type. Forge also adds `visibleWhen`
and `metadata` to the builder automatically.

---

## Declaring the component

Pass the props interface directly to `component()`. The result is a callable block
builder - authors call it with expression-aware props and never set the variant
themselves - and the same value carries the component entry.

For a display block:

```typescript
import { component } from '@ministryofjustice/hmpps-forge/core/components'

export const MyCard = component<MyCardProps>('myCard', {
  factory: () => ({ props }) => {
    const border = props.outlined ? ' my-card--outlined' : ''

    return `
      <div class="my-card${border}">
        <h2 class="govuk-heading-m">${props.heading}</h2>
        ${props.content ? `<p class="govuk-body">${props.content}</p>` : ''}
      </div>
    `
  },
})
```

For a field block, declare only its visual props and set `field: true`.
The builder gains `code`, validation, defaults, parsers and formatters;
the renderer gains the resolved `code`, `value`, and `errors` described below.

```typescript
import { component } from '@ministryofjustice/hmpps-forge/core/components'

export interface MyStarRatingProps {
  label: string
  maximum?: number
}

export const MyStarRating = component<MyStarRatingProps>('myStarRating', {
  field: true,
  factory: () => ({ props }) => { ... },
})
```

---

## The renderer

The function returned by `factory` receives `{ props, context }` and returns
rendered output. Renderer-specific helpers keep a simpler props-first callback.

### Pure function components

The plain `component()` form shown above is framework-independent. Its factory
creates the evaluator that receives the resolved props. Use it when the output
is short, self-contained, and does not need a template engine.

### Template-based components

`nunjucksComponent` (from `@ministryofjustice/hmpps-forge/express-nunjucks`)
is the right choice when you want to render through a Nunjucks
template. It is a compatibility wrapper around `component()`: the render callback
receives the resolved props and a Nunjucks environment supplied by Forge.

```typescript
import { nunjucksComponent } from '@ministryofjustice/hmpps-forge/express-nunjucks'

export const MyCard = nunjucksComponent<MyCardProps>('myCard', {
  render: (block, nunjucksEnv) => {
    const params = {
      heading: block.heading,
      content: block.content,
      outlined: block.outlined,
    }

    return nunjucksEnv.render('components/my-card/template.njk', { params })
  },
})
```

The built-in GOV.UK and MOJ components follow this pattern. Each one
extracts a `params` object from the resolved props, then hands that
to the matching design-system template. Your own Nunjucks components
should do the same: keep the renderer thin, and let the template
deal with markup.

---

## What the render props contain

The props passed to your renderer are inferred from the plain interface.
The important points:

- **Plain props stay plain.** A declared `heading: string` is a `string`
  in `render`, even when the journey author supplied an expression.
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
export const GovUKTextInput = nunjucksComponent<GovUKTextInput>('govukTextInput', {
  field: true,
  render: (block, nunjucksEnv) => {
    const params = {
      id: block.id ?? block.code,
      name: block.code,
      label: typeof block.label === 'object' ? block.label : { text: block.label },
      value: block.value,
      errorMessage: block.errors?.length && { text: block.errors[0].message },
    }

    return nunjucksEnv.render('govuk/components/input/template.njk', { params })
  },
})
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

export const MyBadge = component<MyBadge>('myBadge', {
  factory: () => ({ props }) => {
    const label = escapeHtml(String(props.label ?? ''))

    return `<span class="my-badge">${label}</span>`
  },
})
```

Attributes need the same treatment. When building a class or data
attribute from a dynamic prop, escape both the key and the value.

---

## Registration

Building a block with a component in a journey definition is also
what registers it. At `registerPackage()`, Forge collects every
component the journey's blocks were built with and registers it for
that package - there is nothing to list:

```typescript
export default createForgePackage({
  journey: myJourney,
})
```

Components collected this way are scoped to that package's journey.
Two packages can each carry a component with the same variant
without clashing.

If a journey refers to a component only by variant string - a
journey defined in JSON, or blocks authored as plain objects -
nothing builds blocks through the component, so there is nothing to
collect. List the component declaration on the package's `functions` property
to register it regardless:

```typescript
import { createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { MyCard } from './components/myCard'

export default createForgePackage({
  journey: myJourney,
  functions: [MyCard],
})
```

Components are always scoped to the package that registers them.
Sharing one across journeys just means using it in each journey -
the same handle registers wherever it is used. This is how the
GOV.UK and MOJ component packages work too.

---

## Using custom components

A custom component is used like any built-in:

```typescript
import { MyCard } from './components/myCard'

GovUKInsetText({ text: 'Welcome back.' })

MyCard({
  heading: Format('Hello, %1', Answer('firstName')),
  content: Data('user.bio'),
  outlined: true,
})
```

The component's call signature derives expression-aware versions of the plain
props, so authors can pass expressions wherever the declared result type allows.
Forge resolves them before calling the renderer.

---

## Testing

`ComponentTestHarness` tests the same author-facing component call used in
a journey. It looks up the registered component function, renders nested blocks first,
and invokes it through Forge's rendering boundary. Tests do not need
to construct internal render props:

```typescript
import { ComponentTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'
import { MyCard } from './myCard'

describe('MyCard', () => {
  describe('component()', () => {
    it('should include the heading text', async () => {
      // Arrange
      const harness = new ComponentTestHarness(MyCard)
      const block = MyCard({
        heading: 'Hello',
        content: 'Body text',
        outlined: false,
      })

      // Act
      const html = await harness.render(block)

      // Assert
      expect(html).toContain('Hello')
      expect(html).toContain('Body text')
    })
  })
})
```

For a `nunjucksComponent`, pass the Nunjucks environment as the harness's
adapter renderer and assert on its template call:

```typescript
it('should pass heading to the template', async () => {
  // Arrange
  const nunjucksEnv = { render: jest.fn().mockReturnValue('<div></div>') }
  const harness = new ComponentTestHarness(MyCard, nunjucksEnv)

  // Act
  await harness.render(MyCard({ heading: 'Hello' }))

  // Assert
  expect(nunjucksEnv.render).toHaveBeenCalledWith(
    'components/my-card/template.njk',
    { params: expect.objectContaining({ heading: 'Hello' }) },
  )
})
```

Field runtime values and errors use the same injected-input shape as the
function harness:

```typescript
const harness = new ComponentTestHarness(MyInput, nunjucksEnv)

await harness
  .render(MyInput({ code: 'name', label: 'Name' }))
  .withValue('Ada', [{ message: 'Check the name' }])
```

Use concrete authored values in component unit tests. Use `ForgeTestHarness`
when the test is about resolving expressions from answers, data or request state.

---

## Best practices

- **Declare the values the renderer actually consumes.** Plain string,
  boolean, number, array and object types become expression-aware in the
  component's builder automatically.
- **Keep renderers thin.** A renderer pulls values off the
  resolved props and hands them to a template or a short HTML
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
- **Let use drive registration.** Building a block with a component
  registers it for that journey's package - the same handle
  registers wherever it is used, so shared components need no
  special treatment.
