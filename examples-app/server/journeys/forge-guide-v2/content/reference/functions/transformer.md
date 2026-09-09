---
title: transformer()
slug: transformer
section: reference
path: reference/transformer
nav: Authoring API/Functions
order: 31
description: Defines a function that receives a value and returns a new shape of it
teaches: [transformer, inputSchema, argumentsSchema, factory, dependencies, built-in-transformers, pipe]
prerequisites: []
related:
  concept: how-expressions-work
  how-to: creating-your-own-custom-transformer
  reference: condition, match
---

# `transformer()`

`transformer()` defines a function that receives a value and returns a new shape of it. You use transformers with `.pipe()` to format answers, convert types, and reshape data before it reaches a field, a [condition](./condition), or a check-answers summary.

```typescript
import { transformer } from '@ministryofjustice/hmpps-forge/core/authoring'

const NormaliseCaseReference = transformer('Cases.NormaliseCaseReference', {
  inputSchema: z.string(),
  factory: () => (value: string) => value.trim().toUpperCase(),
})

// In a journey definition:
Answer('caseReference').pipe(NormaliseCaseReference())
```

---

## Reference

### `transformer(name, options)`

Creates a named transformer. When you use it in a journey definition, it registers itself automatically - no registry or `functions` listing needed.

```typescript
function transformer(name: string, options: TransformerOptions): TransformerEntry
```

You can also omit the name to create an anonymous transformer:

```typescript
function transformer(options: TransformerOptions): TransformerEntry
```

#### Options

:::param
---
name: factory
type: "(deps) => (value, ...args) => output | Promise\<output>"
required: true
---
A function that builds the evaluator. The outer function receives your application's
dependencies (or an empty object when there are none). The inner function receives the
value to transform, followed by any authored arguments, and returns the new value.

- **`deps`** - your application's dependencies, such as an API client or a service.
- **`value`** - the value to transform. This is whatever `.pipe()` is called on:
  an [`Answer('caseReference')`](./answer), a [`Data('case.name')`](./data), or the output of a previous
  transformer in the same pipeline.
- **`...args`** - the arguments authored at the call site. `Truncate(20)` passes `20`
  as the first argument. Each argument also accepts an expression, so
  `Truncate(Answer('maxLength'))` works too.

The factory runs during context preparation for each request. It receives the merged
package, adapter, and request dependencies. Duplicate keys across these sources cause an
error. The returned evaluator is called each time the transformer runs during a request.
:::

:::param
---
name: inputSchema
type: ZodType
required: false
---
Validates the value before the evaluator runs. When the value is `null` or `undefined`, the
transformer returns `undefined` without calling your function. When the value is defined
but does not match the schema, the transformer throws a `TypeError`.

[See describing the value your transformer accepts.](#describe-the-value-your-transformer-accepts)
:::

:::note
---
---
This is different from conditions, which return `false` in both cases.
:::

:::param
---
name: argumentsSchema
type: ZodType
required: false
---
Validates the authored arguments at runtime. A failing argument is an authoring mistake,
so it throws rather than returning a result. Also drives arity checking at compilation.

[See adding configuration with arguments.](#add-configuration-with-arguments)
:::

:::param
---
name: outputSchema
type: ZodType
required: false
---
Validates the evaluator's return value. Use this when the transformed result must have
a specific shape - for example, when downstream code depends on the output being a
number or a particular object structure.
:::

:::param
---
name: prepare
type: "(...args) => unknown[]"
required: false
---
Transforms the authored arguments before they are embedded in the expression. It runs
once at definition time (when the module loads), not on every request. Use it to
validate arguments early or to reshape them into a different form for the evaluator.

When present, its parameter types become the entry's call signature instead of the
evaluator's trailing parameters.
:::

#### Returns

A `TransformerEntry` - a function you call with arguments to produce a transformer
expression. The expression works with `.pipe()` and anywhere else a transformer is
accepted.

The entry also carries the function's metadata (`name`, schemas,
`factory`). When you use it in a journey definition, it registers itself - you don't
need to add it to a registry or a `functions` array.

#### Caveats

- Schemas validate values without transforming them. Evaluators receive the original
  input and arguments, and their original return value is preserved.

- A transformer receiving `null` or `undefined` returns `undefined` before its schema
  or evaluator runs. Each subsequent transformer applies the same check.

- Formatters and `.pipe()` handle type mismatches differently. In `.pipe()`, an
  `inputSchema` mismatch throws a `TypeError` and fails the request. In `formatters`,
  the same mismatch reverts to the original submitted value and abandons the rest of the
  formatter pipeline. Validation then runs against the unformatted value and can report
  the problem as a field message.

---

## Usage

### Create a transformer that reshapes a value

The simplest transformer takes a value and returns a new one:

```typescript
const NormaliseCaseReference = transformer('Cases.NormaliseCaseReference', {
  factory: () => (value: unknown) => {
    return typeof value === 'string' ? value.trim().toUpperCase() : value
  },
})
```

Use it in a pipeline with `.pipe()`:

```typescript
Answer('caseReference').pipe(NormaliseCaseReference())
```

`Answer('caseReference')` resolves the stored answer. `.pipe()` passes that value into the transformer as `value`, and the pipeline produces the transformed result.

### Chain transformers in a pipeline

`.pipe()` accepts multiple transformers. Each one receives the output of the previous:

```typescript
Answer('dateOfBirth').pipe(
  Transformer.String.ToDate(),
  Transformer.Date.Format('D MMMM YYYY'),
)
```

The first transformer parses the date string into a `Date` object. The second formats
that `Date` into a readable string like "18 March 2026". The pipeline runs left to
right, and each transformer sees the result of the one before it.

### Describe the value your transformer accepts

Adding an `inputSchema` lets you skip the type-checking and focus on the transformation:

```typescript
const NormaliseCaseReference = transformer('Cases.NormaliseCaseReference', {
  inputSchema: z.string(),
  factory: () => (value: string) => value.trim().toUpperCase(),
})
```

When the value is `null` or `undefined`, the transformer returns `undefined` without calling your
function. When the value is defined but is not a string, the transformer throws a
`TypeError`. Your function can now receive a `string` directly and focus on the
transformation.

:::note
---
---
This differs from conditions, which return `false` when the schema fails. A transformer
treats a schema mismatch on a defined value as a bug rather than a normal outcome.
:::

### Add configuration with arguments

When the same transformation applies to different cases with different parameters, add
arguments instead of creating separate transformers:

```typescript
const Truncate = transformer('Text.Truncate', {
  inputSchema: z.string(),
  argumentsSchema: z.tuple([z.number()]),
  factory: () => (value: string, maxLength: number) => {
    if (value.length <= maxLength) {
      return value
    }
    return value.slice(0, maxLength - 1) + '…'
  },
})
```

Set the maximum length at the call site:

```typescript
Answer('summary').pipe(Truncate(120))
```

The answer supplies the value through `.pipe()`. The `120` argument is authored in the
definition and arrives as `maxLength`. If the definition passes a value the
`argumentsSchema` does not accept, an error is reported instead of running the
transformer with configuration it does not understand.

Arguments also accept expressions, so you can pass a resolved value:

```typescript
Answer('summary').pipe(Truncate(Answer('maximumLength')))
```

### Use an application dependency

When a transformer needs to call a service - looking up a readable name for a code,
for example - type the factory's `deps` parameter:

```typescript
const ResolveLocationName = transformer('Cases.ResolveLocationName', {
  inputSchema: z.string(),
  factory: (deps: { locationService: LocationService }) =>
    async (value: string) => {
      const location = await deps.locationService.getByCode(value)
      return location?.name ?? value
    },
})
```

The dependency is supplied when the application registers the package:

```typescript
forge.registerPackage(casesPackage, {
  locationService: services.locationService,
})
```

If the location service returns a result, the transformer produces the readable name.
If not, it falls back to the original code.

### Return an asynchronous result

When the evaluator calls an asynchronous service, return a promise. Evaluation waits
for it before the pipeline continues:

```typescript
factory: (deps: { locationService: LocationService }) =>
  async (value: string) => {
    return deps.locationService.getByCode(value)
  },
```

Synchronous transformers don't need to return a promise - a plain value works.

### Use a transformer as a field formatter

Transformers also work as field formatters. A formatter runs on the submitted value
before validation:

```typescript
GovUKTextInput({
  code: 'caseReference',
  formatters: [NormaliseCaseReference()],
})
```

The field stores the transformed value, so validation and downstream logic see the
normalised form rather than the raw input.

---

## Built-in transformers

The `Transformer` namespace provides ready-made transformers for common operations.
They all work with `.pipe()` and as field formatters just like custom transformers.

```typescript
import { Transformer } from '@ministryofjustice/hmpps-forge/core/authoring'

Answer('name').pipe(Transformer.String.Trim(), Transformer.String.ToTitleCase())
Answer('score').pipe(Transformer.Number.Clamp(0, 100))
Answer('tags').pipe(Transformer.Array.Unique(), Transformer.Array.Sort())
```

### String

| Transformer | Result |
|---|---|
| `Transformer.String.Trim()` | Removes whitespace from both ends |
| `Transformer.String.ToUpperCase()` | Converts to uppercase |
| `Transformer.String.ToLowerCase()` | Converts to lowercase |
| `Transformer.String.ToTitleCase()` | Capitalises first letter of each word |
| `Transformer.String.Capitalize()` | Capitalises first letter |
| `Transformer.String.Possessive()` | Converts a name to possessive form ("John" to "John's", "James" to "James'") |
| `Transformer.String.Substring(start, end?)` | Extracts a substring by position |
| `Transformer.String.Replace(search, replace)` | Replaces all occurrences of `search` with `replace` |
| `Transformer.String.PadStart(length, pad?)` | Left-pads to target length |
| `Transformer.String.PadEnd(length, pad?)` | Right-pads to target length |
| `Transformer.String.ToInt()` | Parses a string to an integer |
| `Transformer.String.ToFloat()` | Parses a string to a float |
| `Transformer.String.ToArray(separator?)` | Splits into an array (by character if no separator) |
| `Transformer.String.ToDate()` | Parses a UK-format (DD/MM/YYYY) or ISO date string to a `Date` |
| `Transformer.String.FormatDate(options?)` | Formats a date string using `Intl.DateTimeFormat` (defaults to UK long date) |
| `Transformer.String.ToISODate()` | Converts a UK-format date string (DD/MM/YYYY) to ISO (YYYY-MM-DD) |
| `Transformer.String.ToTimestampDate()` | Converts an epoch millisecond string to a `Date` |
| `Transformer.String.EscapeHtml()` | Escapes HTML characters to prevent XSS |

### Number

| Transformer | Result |
|---|---|
| `Transformer.Number.Add(n)` | Adds `n` |
| `Transformer.Number.Subtract(n)` | Subtracts `n` |
| `Transformer.Number.Multiply(n)` | Multiplies by `n` |
| `Transformer.Number.Divide(n)` | Divides by `n` (throws on zero) |
| `Transformer.Number.Abs()` | Absolute value |
| `Transformer.Number.Round()` | Rounds to nearest integer |
| `Transformer.Number.Floor()` | Rounds down |
| `Transformer.Number.Ceil()` | Rounds up |
| `Transformer.Number.ToFixed(decimals)` | Rounds to `decimals` decimal places |
| `Transformer.Number.Max(n)` | Returns the greater of the value and `n` |
| `Transformer.Number.Min(n)` | Returns the lesser of the value and `n` |
| `Transformer.Number.Power(exponent)` | Raises to `exponent` |
| `Transformer.Number.Sqrt()` | Square root (throws on negative) |
| `Transformer.Number.Clamp(min, max)` | Clamps between `min` and `max` |

### Array

| Transformer | Result |
|---|---|
| `Transformer.Array.Length()` | Returns the array length |
| `Transformer.Array.Compact()` | Removes `null` and `undefined` items, preserving `0`, `false`, and empty strings |
| `Transformer.Array.First()` | Returns the first element (or `undefined`) |
| `Transformer.Array.Last()` | Returns the last element (or `undefined`) |
| `Transformer.Array.Reverse()` | Returns a new reversed array |
| `Transformer.Array.Join(separator?)` | Joins elements into a string (defaults to `','`) |
| `Transformer.Array.Slice(start, end?)` | Returns a slice of the array |
| `Transformer.Array.Concat(...arrays)` | Concatenates additional arrays |
| `Transformer.Array.Unique()` | Removes duplicates |
| `Transformer.Array.Sort()` | Sorts ascending (numeric-aware) |
| `Transformer.Array.Filter(value)` | Keeps only elements equal to `value` |
| `Transformer.Array.Map(property)` | Extracts a property from each element |
| `Transformer.Array.Flatten()` | Flattens one level |

### Object

| Transformer | Result |
|---|---|
| `Transformer.Object.ToISO(paths)` | Converts an object with date parts (`{ year, month, day }`) to an ISO date string |
| `Transformer.Object.FromISO(paths)` | Converts an ISO date string back to an object with date parts |

### Date

| Transformer | Result |
|---|---|
| `Transformer.Date.Format(format)` | Formats using tokens (`YYYY`, `MM`, `DD`, `HH`, `mm`, `ss`, and others) |
| `Transformer.Date.AddDays(n)` | Adds `n` days (negative to subtract) |
| `Transformer.Date.SubtractDays(n)` | Subtracts `n` days |
| `Transformer.Date.AddMonths(n)` | Adds `n` months |
| `Transformer.Date.AddYears(n)` | Adds `n` years |
| `Transformer.Date.StartOfDay()` | Returns midnight (00:00:00.000) |
| `Transformer.Date.EndOfDay()` | Returns end of day (23:59:59.999) |
| `Transformer.Date.ToISOString()` | Converts to an ISO-8601 string |
| `Transformer.Date.ToLocaleString(locale?)` | Converts to a locale string |
| `Transformer.Date.ToUKLongDate()` | Formats as a UK long date (for example, "18 March 2026") |

---

## Troubleshooting

### The transformer returns `undefined`

If the value reaching `.pipe()` is `null` or `undefined`, the
transformer returns `undefined` without calling your function. Check that the value
source resolves to something before the pipeline runs - for example, an `Answer()` for
a field that has not been submitted yet will be `undefined`.

### The transformer throws a `TypeError`

If the value is defined but does not match the `inputSchema`, the transformer throws a
`TypeError`. This is different from conditions, which return `false` in the same
situation. Check that the value has the shape your schema expects - for example, a
numeric field may store its value as a string rather than a number.

### An argument error is thrown instead of the transformer running

The `argumentsSchema` failed. This means the definition passed a value the schema
does not accept - for example, a negative number when the schema requires a positive
one. Fix the value at the call site.

### The transformer doesn't register

Make sure the transformer is actually used in a journey definition. The entry registers
itself when it appears in a `.pipe()`, a `formatters` array, or similar context inside
a registered package. Defining the transformer alone does not register it - it needs to
be part of a journey.
