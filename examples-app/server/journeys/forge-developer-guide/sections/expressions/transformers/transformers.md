---
title: Transformers
section: authoring-language
path: authoring-language/transformers
teaches: [Transformer, pipe, formatters, parsers]
prerequisites: [Answer, Data, Generator]
---

<p class="govuk-caption-xl">Functions</p>

# Transformers

Transformers convert values from one form to another. They are
applied through `.pipe()` on references and generators, through
the `formatters` property on fields for submission, and through the
`parsers` property on fields for display. Forge ships with
transformers for strings, dates, numbers, arrays, and objects, and
you can define your own.

{{slot:toc}}

---

## What is a transformer?

A transformer is a function that takes a value and returns a new
value. It does not look anything up or produce anything from
nothing. It takes what it is given and reshapes it.

```typescript
import { Transformer } from '@ministryofjustice/hmpps-forge/core/authoring'

Answer('email').pipe(Transformer.String.Trim(), Transformer.String.ToLowerCase())
```

Transformers are used in three places:

- **`.pipe()`** on references and generators, where they transform
  values for display, conditions, or block properties
- **`formatters`** on fields, where they normalise submitted values
  before validation runs
- **`parsers`** on fields, where they convert stored values back to
  the form a component needs for display

The distinction matters. `.pipe()` transforms values at evaluation
time, whenever the expression is resolved. `formatters` only run
during the submission pipeline, after the raw value is captured from
the POST body but before validation. `parsers` only run when loading
a stored value back into a field for display.

---

## How it works

### Piping

`.pipe()` accepts one or more transformers and applies them in
sequence. Each transformer receives the output of the previous one:

```typescript
Answer('appointmentDate').pipe(
  Transformer.String.ToDate(),
  Transformer.Date.Format('D MMMM YYYY'),
)
```

Here `Transformer.String.ToDate()` converts the string to a `Date`
object, then `Transformer.Date.Format()` converts that `Date` into
a formatted string. The final result is what the block receives.

### Formatters

The `formatters` property on a field runs transformers during
submission only. This is where you normalise input before
validation sees it:

```typescript
GovUKTextInput({
  code: 'email',
  label: { text: 'Email address' },
  formatters: [Transformer.String.Trim(), Transformer.String.ToLowerCase()],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter your email address',
    }),
  ],
})
```

Without the trim, a value of `"   "` would pass `IsRequired()`.
The formatter strips whitespace before validation runs, so empty
input is correctly caught.

### Parsers

The `parsers` property is the inverse of `formatters`. Where
formatters transform submitted input into a canonical stored form,
parsers transform that stored form back into what the component
needs for display.

Most fields do not need parsers. A formatter that trims whitespace
or lowercases a string does not change the shape of the data, so
the component can display the stored value directly. Parsers are
only needed when a formatter changes the data into a shape the
component cannot render. In practice, this means multi-part
components like date inputs where the formatter collapses several
inputs into a single stored value.

For example, a date input submits `{ day, month, year }` and a
formatter collapses that into an ISO string like `"1990-03-27"`.
When the user returns to that page, the date input needs the 3
parts back, not the ISO string. Without a parser, the component
would receive a value it cannot display.

```typescript
// GovUKDateInputFull adds these automatically - no need to specify them
GovUKDateInputFull({
  code: 'dateOfBirth',
  fieldset: { legend: { text: 'Date of birth', isPageHeading: true } },
})

// For custom components, you would add them explicitly:
field({
  variant: 'myCustomDateInput',
  code: 'startDate',
  formatters: [Transformer.Object.ToISO({ year: 'year', month: 'month', day: 'day' })],
  parsers: [Transformer.Object.FromISO({ year: 'year', month: 'month', day: 'day' })],
})
```

Parsers run when loading a stored value for display. They do not
run on submission, and they do not change the stored answer.
Conditions, remote references, and any other code that reads the
answer always see the canonical stored form.

Like formatters, parsers accept one or more transformers and apply
them in sequence. Each parser receives the output of the previous
one.

### Type bridging

Transformers also bridge the gap between what a component submits
and what conditions expect. For example, date components may submit
different formats to what date conditions need:

```typescript
// A date picker submitting DD/MM/YYYY
formatters: [Transformer.String.ToISODate()]

// A three-part input submitting { day, month, year }
formatters: [Transformer.Object.ToISO({ year: 'year', month: 'month', day: 'day' })]
```

Without the transformer, date conditions would receive raw input
they cannot interpret.

---

## Using in your definitions

### Transforming for display

Format a date for a confirmation page:

```typescript
Answer('appointmentDate').pipe(
  Transformer.String.ToDate(),
  Transformer.Date.Format('D MMMM YYYY'),
)
```

Capitalise a location name:

```typescript
Answer('location').pipe(Transformer.String.Capitalize())
```

### Computing values from generators

Build a date range from today:

```typescript
minDate: Generator.Date.Today().pipe(
  Transformer.Date.Format('DD/MM/YYYY'),
),
maxDate: Generator.Date.Today().pipe(
  Transformer.Date.AddDays(30),
  Transformer.Date.Format('DD/MM/YYYY'),
),
```

### Getting collection counts

Count the items in a filtered collection:

```typescript
const activeGoalCount = Data('goals')
  .each(Iterator.Filter(
    Item().path('status').match(Condition.Equals('ACTIVE')),
  ))
  .pipe(Transformer.Array.Length())
```

### Escaping HTML

When piping untrusted data into HTML contexts, escape it first:

```typescript
Item().path('name').pipe(Transformer.String.EscapeHtml())
```

---

## Custom transformers

When the built-in set does not cover a reshaping step your
definitions need, you can define your own. Custom transformers are
used the same way as built-ins: with `.pipe()` on references and
generators, and in the `formatters` property on fields.

See [Building custom transformers](building-functions-and-components/custom-transformers)
for the shape interface, implementation, type-checking conventions,
and registration details.

---

## API surface

### `.pipe(...transformers)`

Applies transformers in sequence to a reference or generator.
Available on all chainable references and generator expressions.

```typescript
Answer('email').pipe(Transformer.String.Trim())
```

Transformer arguments can accept both static values and
expressions:

```typescript
Transformer.String.Substring(0, 5)                    // static
Transformer.String.Replace(Answer('search'), 'fixed') // dynamic
```

---

## Best practices

- **Use `formatters` for normalising input, `parsers` for
  reversing it, `.pipe()` for transforming output.** Formatters
  run on submission only and affect what validation sees. Parsers
  run on display only and affect what the component receives.
  `.pipe()` runs at evaluation time and affects what blocks display.
- **Add `parsers` when formatters change the shape of data.** If
  a formatter converts `{ day, month, year }` to `"1990-03-27"`,
  the component needs a parser to get the parts back. If a
  formatter just trims whitespace, no parser is needed.
- **Chain transformers in logical order.** Each transformer receives
  the output of the previous one. `Trim` before `ToLowerCase`,
  `ToDate` before `Date.Format`.
- **Use `EscapeHtml()` for untrusted data in HTML contexts.**
  User input and external API data should be escaped before being
  interpolated into HTML strings.

---

## Built-in transformers

For the full reference of every built-in transformer with detailed
descriptions and examples, see the Forge Core package pages:

- [String transformers](/forge-developer-guide/packages/forge-core/transformers-string) - trim, case, substring, conversion, escaping
- [Date transformers](/forge-developer-guide/packages/forge-core/transformers-date) - formatting, arithmetic, boundaries
- [Number transformers](/forge-developer-guide/packages/forge-core/transformers-number) - arithmetic, rounding, clamping
- [Array transformers](/forge-developer-guide/packages/forge-core/transformers-array) - slicing, joining, mapping, filtering
- [Object transformers](/forge-developer-guide/packages/forge-core/transformers-object) - date part conversion
