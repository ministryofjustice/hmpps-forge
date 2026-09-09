---
title: Literal()
slug: literal
section: reference
path: reference/literal
nav: Authoring API/References
order: 50
description: Creates a chainable expression from a static value
teaches: [literal, references, static-values, iteration]
prerequisites: [step]
related:
  reference: data, answer, loop
---

# `Literal()`

`Literal()` wraps a static value so you can chain expression methods on it. You use it
when a plain value needs `.pipe()`, `.match()`, or `.each()` - places where a raw array
or string has no methods to call.

```typescript
import { Literal } from '@ministryofjustice/hmpps-forge/core/authoring'

// Iterate a static array to build a list
Literal(['Apple', 'Banana', 'Cherry']).each(Iterator.Map(...))

// Test a static value against a condition
Literal(42).match(Condition.Number.GreaterThan(0))

// Transform a static value
Literal('hello world').pipe(Transformer.String.ToUpperCase())
```

A plain value works on its own wherever a `ResolvableValue` is accepted. `Literal()`
is only needed when you want to chain methods off that value.

---

## Reference

### `Literal(value)`

Creates a chainable expression from a static value.

```typescript
function Literal(value: ResolvableValue): ChainableExpr
```

:::param
---
name: value
type: "ResolvableValue"
required: true
---
The value to wrap. Accepts strings, numbers, booleans, `null`, arrays, and plain
objects. The value passes through with no transformation.
:::

#### Returns

A `ChainableExpr` - an immutable expression builder with the same chainable methods
as other references: `.path()`, `.pipe()`, `.match()`, `.not`, and `.each()`. See the
[Answer() methods documentation](./answer#methods) for details.

---

## Usage

### Iterate a static array

The most common use - turn a static array into repeated content:

```typescript
const areas = ['Health', 'Education', 'Employment']

GovUKList({
  items: Literal(areas).each(
    Iterator.Map({
      text: Loop.Item().value(),
    })
  ),
})
```

Each array entry becomes a list item. This is a shortcut for small, co-located data.
For larger datasets, load the data into [`Data()`](./data) through an effect instead.

### Map a static array into a structure

```typescript
const areasOfNeed = [
  { value: 'health', text: 'Health' },
  { value: 'education', text: 'Education' },
]

GovUKRadios({
  code: 'selectedArea',
  items: Literal(areasOfNeed).each(
    Iterator.Map({
      value: Loop.Item().path('value'),
      text: Loop.Item().path('text'),
    })
  ),
})
```

### Test a static value against a condition

```typescript
Literal(42).match(Condition.Number.GreaterThan(0))
```

This creates a predicate from a fixed value. It is more useful when the value comes
from a shared constant and the condition varies between uses.

### Transform a static value

```typescript
Literal('hello world').pipe(
  Transformer.String.Trim(),
  Transformer.String.ToUpperCase(),
)
```

---

## Troubleshooting

### Using Literal() when a plain value works

If you are not chaining any methods, you do not need `Literal()`. A plain value works
anywhere a `ResolvableValue` is accepted:

```typescript
// Unnecessary - no methods are chained
GovUKHeading({ text: Literal('Welcome') })

// Use the value directly
GovUKHeading({ text: 'Welcome' })
```

`Literal()` earns its place only when you chain `.pipe()`, `.match()`, or `.each()`.
