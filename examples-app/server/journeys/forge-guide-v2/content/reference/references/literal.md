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
when a plain value needs `.pipe()`, `.nullish()`, `.match()`, or `.each()` - places where a raw array
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

A `ChainableExpr` - an immutable expression builder you can use directly as a value or
chain with the methods below.

### Methods

#### `.path(key)`

Navigates deeper into the referenced value.

```typescript
path(key: string): ChainableExpr
```

:::param
---
name: key
type: "string"
required: true
---
The property to read from the resolved value. Dot notation navigates through
nested properties. A missing intermediate value resolves to `undefined` rather
than throwing an error.
:::

```typescript
Literal({ postcode: 'SW1H 9AJ' }).path('postcode')
```

Use `.path()` after another operation when you need to read a property from its
result.

#### `.pipe(...steps)`

Passes the referenced value through one or more [transformers](./transformer) in sequence.

```typescript
pipe(...steps: TransformerFunctionExpr[]): ChainableExpr
```

:::param
---
name: steps
type: "TransformerFunctionExpr[]"
required: false
---
The transformers to apply, passed as separate arguments in execution order. Each
transformer receives the previous step's output. With no arguments, the expression
keeps its value.
:::

Pass multiple transformers to apply them in sequence:

```typescript
Literal('hello world').pipe(
  Transformer.String.Trim(),
  Transformer.String.ToLowerCase(),
)
```

When the value is absent, the pipeline is skipped and the expression stays absent.
The pipeline produces a value for this expression without changing the source value.

The returned expression continues the chain with `.path()`, `.pipe()`, `.nullish()`,
`.match()`, or `.each()`. Use `.not.match()` to negate a condition on its result.

#### `.nullish(fallback)`

Uses a fallback when the referenced value resolves to `null` or `undefined`.

```typescript
nullish(fallback: ResolvableValue | undefined): ChainableExpr
```

:::param
---
name: fallback
type: "ResolvableValue | undefined"
required: true
---
The value to use when the input resolves to `null` or `undefined`. Accepts a literal,
another reference, a generator call, or another value expression. Passing `undefined`
leaves a missing result absent.
:::

The fallback can be a fixed value or another expression:

```typescript
Literal('hello world').nullish('Not provided')
```

Forge evaluates the input once and evaluates the fallback only when the input is
`null` or `undefined`.

Empty strings, `false`, `0`, empty arrays, and empty objects keep their original value.
The returned expression continues the chain with `.path()`, `.pipe()`, `.match()`,
`.each()`, or another `.nullish()`. It does not change the source value.

`.nullish()` does not catch errors. If the input throws, that error propagates without
running the fallback. References in the fallback still follow their normal scope rules;
for example, `Loop.Item()` needs an enclosing iterator.

#### `.match(condition)`

Tests the referenced value against a [condition](./condition). Returns an expression
that resolves to a boolean and can be used wherever a resolvable value is accepted.

```typescript
match(condition: ConditionFunctionExpr): PredicateTestExpr
```

:::param
---
name: condition
type: "ConditionFunctionExpr"
required: true
---
The condition to test against the resolved value. Pass a built-in condition such as
`Condition.IsRequired()`, or a custom condition entry. The resolved value becomes
the condition's `value` argument.
:::

For example, test whether the value is present:

```typescript
Literal('hello world').match(Condition.IsRequired())
```

Use the result in `when`, `validWhen`, `visibleWhen`, or anywhere else that a
boolean/predicate is accepted.

#### `.not`

Negates the next `.match()`. This is a property, not a method - no parentheses needed.

```typescript
readonly not: ChainableNegation
```

`.not` takes no parameters.

```typescript
Literal('hello world').not.match(Condition.Equals(''))
```

After `.not`, only `.match()` and another `.not` are available. You cannot `.pipe()` or
`.path()` after negation. `.not.not` cancels itself out.

#### `.each(iterator)`

Iterates over the referenced value when it contains an array or collection.

```typescript
each(iterator: MapIteratorConfig | FilterIteratorConfig): ChainableIterable
each(iterator: FindIteratorConfig): ChainableExpr
each(iterator: SomeIteratorConfig | EveryIteratorConfig): CollectionPredicateExpr
each(iterator: CountIteratorConfig): ChainableExpr
```

:::param
---
name: iterator
type: "IteratorConfig"
required: true
---
The per-item operation to perform. Create it with `Iterator.Map()`,
`Iterator.Filter()`, `Iterator.Find()`, `Iterator.Some()`, `Iterator.Every()`, or
`Iterator.Count()`. Item references and predicates resolve within that iteration.
:::

The iterator determines the result: an iterable (`Map` and `Filter`), a single value
(`Find`), a predicate (`Some` and `Every`), or a chainable number (`Count`).

See [`Iterator`](./iterator) for configuration and usage.

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

GovUKRadioInput({
  code: 'selectedArea',
  label: 'Which area do you need help with?',
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

### Use a fallback for an absent value

Use `.nullish()` to supply a fallback when the reference resolves to `null` or
`undefined`:

```typescript
Literal(null).nullish('Not provided')
```

This resolves to `Not provided`. `Literal()` makes the value chainable, so you can
continue with `.pipe()`, `.match()`, or another `.nullish()` call.

Empty strings, `false`, and `0` keep their original value. Forge evaluates the fallback
only when the input is absent. You can also pass another reference or expression as
the fallback.

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

`Literal()` earns its place only when you chain `.pipe()`, `.nullish()`, `.match()`, or `.each()`.
