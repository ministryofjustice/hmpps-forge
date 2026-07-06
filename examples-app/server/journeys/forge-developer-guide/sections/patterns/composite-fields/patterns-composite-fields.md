---
title: Multi-part composite fields
section: patterns
path: patterns/composite-fields
teaches: [composite-fields, GovUKDateInputFull, address-composite, Format, ToISO]
prerequisites: [field, validation, Transformer, Format]
---

<p class="govuk-caption-xl">Patterns</p>

# Multi-part composite fields
Fields that are conceptually one value but collected through several
inputs. Two flavours turn up in practice: a component that owns the
composition internally (date of birth), and separate fields laid out
together that the author composes at display time (a postal address).

<p class="govuk-body"><a class="govuk-button" href="/forge-developer-guide/patterns/demos/composite-fields" data-module="govuk-button">Try the live demo</a></p>

{{slot:toc}}

---

## When to use it

Reach for a composite field whenever the user's mental model of the
value is "one thing" but typing it is easier across multiple inputs.
A date is one value but typing 3 boxes is faster than a single
string. An address is one thing but each part has its own autocomplete
hint, layout, and validation.

**Pick the component-owned flavour** when you have one already (dates
are the main case). The component handles layout, part-specific error
styling, and collapses the submission to one answer for you.

**Pick the author-owned flavour** when no component exists and the
parts each deserve their own validation and autocomplete attributes.
Addresses, composite identifiers, and amount-plus-unit fields fit
this shape.

---

## What the pattern covers

The live demo works end-to-end. Following the flow shows:

- **A component-owned composite** using `GovUKDateInputFull` that
  renders 3 inputs and outputs an ISO string.
- **Pre-built validations** for empty, missing-part, invalid-date,
  and must-be-past cases via `GovUKValidations.DateInputFull`.
- **An author-owned composite** where 4 text inputs on one step
  describe one address, including an optional line 2.
- **A summary** that formats the date for display and composes the
  address into a multi-line block, dropping the optional line when
  it's empty.

---

## Anatomy of the flow

```
/forge-developer-guide/patterns/demos/composite-fields/
├── /overview         → Overview and "Start" button
├── /date-of-birth    → Component-owned composite (GovUKDateInputFull)
├── /address          → Author-owned composite (4 text inputs)
├── /check-answers    → Summary with formatted date and composed address
└── /confirmation     → Panel and restart
```

The 2 composite steps show the 2 flavours side by side. The same flow
shape (one step per composite, converging on a summary) works for
either.

---

## How it works

### Component-owned composite

`GovUKDateInputFull` renders 3 inputs under one fieldset. The browser
submits them as `{ day, month, year }`, and `Transformer.Object.ToISO`
collapses the object into an ISO string before validation runs:

```typescript
GovUKDateInputFull({
  code: 'dateOfBirth',
  fieldset: { legend: { text: 'What is your date of birth?', isPageHeading: true } },
  hint: { text: 'For example, 27 3 1990' },
  validWhen: [
    ...GovUKValidations.DateInputFull({
      empty: { message: 'Enter your date of birth' },
      missingDay: { message: 'Date of birth must include a day' },
      missingMonth: { message: 'Date of birth must include a month' },
      missingYear: { message: 'Date of birth must include a year' },
      invalid: { message: 'Date of birth must be a real date' },
      mustBePast: { message: 'Date of birth must be in the past', submissionOnly: true },
    }),
  ],
})
```

The wrapper automatically adds a formatter (`Transformer.Object.ToISO`)
to convert the 3 parts into a single ISO string on submission, and a
parser (`Transformer.Object.FromISO`) to convert it back when the user
returns to the page. You do not need to add these yourself.

The answer stored under `dateOfBirth` is a single string like
`"1990-03-27"`. Downstream code never sees the 3 parts. That means
referencing `Answer('dateOfBirth')` works like any other string
reference and piping it through date transformers on the summary
page is straightforward:

```typescript
Answer('dateOfBirth').pipe(
  Transformer.String.ToDate(),
  Transformer.Date.Format('D MMMM YYYY'),
)
```

### Field-specific error targeting

`GovUKValidations.DateInputFull` attaches a `details.field` hint to
each missing-part validation. When one of those rules fails, the component applies the error
outline to only that input (for example, only the year box if the
year is missing), rather than colouring all 3 red. This is why the
pre-built set is worth using instead of writing ad-hoc required
checks.

### Author-owned composite

An address is 4 standalone fields on one step. Each one has its own
code, its own validation, and its own autocomplete attribute, but
they sit together under one page heading:

```typescript
GovUKTextInput({
  code: 'addressLine1',
  label: { text: 'Address line 1', classes: GovUKUtilityClasses.Label.Medium },
  autocomplete: 'address-line1',
  validWhen: [validation({
    condition: Self().match(Condition.IsRequired()),
    message: 'Enter the first line of your address',
  })],
})
```

The optional line 2 is just a field with no `validWhen`. An empty
submission is accepted, and the summary page decides whether to
show it.

Postcode chains 2 rules: required first, then format. Ordering
matters. If `IsValidPostcode` ran first, a blank submission would
trigger "Enter a real postcode" instead of "Enter your postcode".

```typescript
GovUKTextInput({
  code: 'addressPostcode',
  formatters: [Transformer.String.Trim(), Transformer.String.ToUpperCase()],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter your postcode',
    }),
    validation({
      condition: Self().match(Condition.Address.IsValidPostcode()),
      message: 'Enter a real postcode',
    }),
  ],
})
```

### Composing on the summary

The defining move of the author-owned flavour is that the step
collects parts and the summary assembles the whole. The demo uses
`NunjucksGenerators.String` to render a small template with `<br>`
separators, gating the optional line 2 with a plain `{% if %}`:

```typescript
const addressDisplay = NunjucksGenerators.String({
  template: `
    {{ line1 }}<br>
    {% if line2 %}{{ line2 }}<br>{% endif %}
    {{ town }}<br>
    {{ postcode }}
  `,
  data: {
    line1: Answer('addressLine1'),
    line2: Answer('addressLine2'),
    town: Answer('addressTown'),
    postcode: Answer('addressPostcode'),
  },
})
```

The row uses `value: { html: addressDisplay }` so the `<br>` tags
render as line breaks. The template renders with autoescape on, so
each user-supplied part is HTML-escaped automatically - a line like
`<script>...</script>` comes out as text, not real markup. Forge
resolves the `Answer()` references in `data` before the template
runs, so the template just sees strings. One change link targets the
address step, so any part can be edited.

---

## Variations

- **Component-owned subsets.** `GovUKDateInputYearMonth` and
  `GovUKDateInputMonthDay` are ready-made variants for expiry dates
  and recurring dates. Same composition story, fewer inputs.
- **Separate change links per part.** When the author-owned composite
  has parts that might be changed independently (a work address vs
  a home address), give each part its own summary row with its own
  change link rather than composing them.
- **Reusable composites.** If you find yourself copy-pasting an
  address across journeys, extract the 4 fields into a shared
  module and import them. The composite is just a group of field
  definitions - nothing stops you packaging them.
- **Future: a dedicated address component.** An author-owned
  composite can usually graduate into a component-owned one. If
  enough services are using the same shape, consider building a
  `GovUKAddressInput` that owns the layout and submits a structured
  address object.
