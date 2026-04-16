---
title: Transformers
section: authoring-language
path: authoring-language/transformers
teaches: [Transformer, pipe, defineTransformerFunctions, custom-transformers, formatters]
prerequisites: [Answer, Data, Generator]
---

<p class="govuk-caption-xl">Functions</p>

# Transformers

Transformers convert values from one form to another. They are
applied through `.pipe()` on references and generators, and through
the `formatters` property on fields. Forge ships with transformers
for strings, dates, numbers, arrays, and objects, and you can
define your own.

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

Transformers are used in two places:

- **`.pipe()`** on references and generators, where they transform
  values for display, conditions, or block properties
- **`formatters`** on fields, where they normalise submitted values
  before validation runs

The distinction matters. `.pipe()` transforms values at evaluation
time, whenever the expression is resolved. `formatters` only run
during the submission pipeline, after the raw value is captured from
the POST body but before validation.

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

You can define your own transformers using
`defineTransformerFunctions`. A custom transformer is referenced in
the journey definition and implemented in the package:

```typescript
import {
  defineTransformerFunctions,
  TransformerFunctionExpr,
} from '@ministryofjustice/hmpps-forge/core/authoring'

export interface MyTransformerShape {
  RelativeTime: () => TransformerFunctionExpr
}

export const { transformers: MyTransformers, implementations: myTransformerImplementations } =
  defineTransformerFunctions<MyTransformerShape, MyDeps>({
    RelativeTime: (deps) => (value: any) => {
      const date = new Date(value)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

      if (diffDays === 0) return 'Today'
      if (diffDays === 1) return 'Yesterday'
      return `${diffDays} days ago`
    },
  })
```

Because transformer inputs are resolved at runtime, you should
verify the value matches the type you expect. If a transformer
receives an unexpected type, throw a `TypeError`. Forge uses
`TypeError` specifically to detect type mismatches: outside of
validation, it immediately surfaces as a configuration error.
Inside `validWhen`, it is caught and treated as a validation
failure. Use `TypeError` for type checks, not `Error`.

```typescript
RelativeTime: (deps) => (value: any) => {
  if (typeof value !== 'string' && !(value instanceof Date)) {
    throw new TypeError('RelativeTime expects a string or Date')
  }
  // ...
}
```

Like all custom functions in Forge, transformers follow the
`(deps) => (value, ...args) => result` pattern. The outer function
receives injected dependencies. Dependencies are injected when you
register the package with `forge.registerPackage(pkg, deps)`.

Use it in a definition:

```typescript
Item().path('createdAt').pipe(MyTransformers.RelativeTime())
```

Register the implementations in the package:

```typescript
export default createForgePackage({
  journey: myJourney,
  functions: {
    ...myTransformerImplementations,
  },
})
```

---

## API surface

### `defineTransformerFunctions(implementations)`

Defines custom transformer functions. Returns a `transformers`
object for use in definitions and an `implementations` object for
registration in a package.

```typescript
import { defineTransformerFunctions } from '@ministryofjustice/hmpps-forge/core/authoring'
```

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

- **Use `formatters` for normalising input, `.pipe()` for
  transforming output.** Formatters run on submission only and
  affect what validation sees. `.pipe()` runs at evaluation time
  and affects what blocks display.
- **Chain transformers in logical order.** Each transformer receives
  the output of the previous one. `Trim` before `ToLowerCase`,
  `ToDate` before `Date.Format`.
- **Use `EscapeHtml()` for untrusted data in HTML contexts.**
  User input and external API data should be escaped before being
  interpolated into HTML strings.
- **Register implementations in the package.** Like effects,
  conditions, and generators, transformer implementations are
  scoped to the package that registers them.

---

## Built-in transformers

### `Transformer.String`

| Transformer | Description |
|---|---|
| `Trim()` | Removes whitespace from both ends |
| `ToUpperCase()` | Converts to uppercase |
| `ToLowerCase()` | Converts to lowercase |
| `ToTitleCase()` | Capitalises the first letter of each word |
| `Capitalize()` | Capitalises the first letter |
| `Possessive()` | Converts a name to possessive form (`John` to `John's`, `James` to `James'`) |
| `Substring(start, end?)` | Extracts a substring |
| `Replace(search, replace)` | Replaces all occurrences |
| `PadStart(length, char?)` | Pads the start to a target length |
| `PadEnd(length, char?)` | Pads the end to a target length |
| `ToInt()` | Converts to an integer |
| `ToFloat()` | Converts to a floating-point number |
| `ToArray(separator?)` | Splits into an array |
| `ToDate()` | Converts a date string to a `Date` object |
| `ToISODate()` | Converts UK format (`DD/MM/YYYY`) to ISO (`YYYY-MM-DD`) |
| `ToTimestampDate()` | Converts an epoch millisecond string to a `Date` |
| `EscapeHtml()` | Escapes HTML entities to prevent XSS |

### `Transformer.Date`

| Transformer | Description |
|---|---|
| `Format(format)` | Formats a `Date` to a string (tokens: `YYYY`, `MM`, `DD`, `Do`, `HH`, `mm`, `ss`, etc.) |
| `AddDays(n)` | Adds days to a `Date` |
| `SubtractDays(n)` | Subtracts days from a `Date` |
| `AddMonths(n)` | Adds months to a `Date` |
| `AddYears(n)` | Adds years to a `Date` |
| `StartOfDay()` | Sets time to midnight |
| `EndOfDay()` | Sets time to `23:59:59.999` |
| `ToISOString()` | Converts to ISO-8601 string |
| `ToLocaleString(locale?)` | Converts to locale-specific string |
| `ToUKLongDate()` | Formats as `18 March 2026` |

### `Transformer.Number`

| Transformer | Description |
|---|---|
| `Add(n)` | Adds a number |
| `Subtract(n)` | Subtracts a number |
| `Multiply(n)` | Multiplies by a number |
| `Divide(n)` | Divides by a number |
| `Abs()` | Returns the absolute value |
| `Round()` | Rounds to the nearest integer |
| `Floor()` | Rounds down |
| `Ceil()` | Rounds up |
| `ToFixed(decimals)` | Rounds to a number of decimal places |
| `Max(n)` | Returns the greater of the value and `n` |
| `Min(n)` | Returns the lesser of the value and `n` |
| `Power(n)` | Raises to the power of `n` |
| `Sqrt()` | Returns the square root |
| `Clamp(min, max)` | Constrains to a range |

### `Transformer.Array`

| Transformer | Description |
|---|---|
| `Length()` | Returns the array length |
| `First()` | Returns the first element |
| `Last()` | Returns the last element |
| `Reverse()` | Reverses the array |
| `Join(separator?)` | Joins elements into a string |
| `Slice(start, end?)` | Extracts a portion of the array |
| `Concat(...arrays)` | Concatenates arrays |
| `Unique()` | Removes duplicates |
| `Sort()` | Sorts in ascending order |
| `Filter(value)` | Keeps elements matching a value |
| `Map(property)` | Extracts a property from each element |
| `Flatten()` | Flattens one level of nesting |

### `Transformer.Object`

| Transformer | Description |
|---|---|
| `ToISO(paths)` | Converts an object with date parts (`{ year, month, day }`) to an ISO date string |
