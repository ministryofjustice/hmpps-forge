---
title: Params()
slug: params
section: reference
path: reference/params
nav: Authoring API/References
order: 57
description: References a route parameter from the current URL
teaches: [params, references, route-parameters]
prerequisites: [step]
related:
  reference: query, post, data
---

# `Params()`

`Params()` references a route parameter from the current URL. You use it to read values
captured by named segments in the route path, like the `:caseId` in `/case/:caseId`.

```typescript
import { Params } from '@ministryofjustice/hmpps-forge/core/authoring'

// Pass a route parameter to an effect
LoadCase(Params('caseId'))

// Display a route parameter
Format('Edit goal %1', Params('goalId'))

// Match a route parameter inside an iterator
Loop.Item().path('id').match(Condition.Equals(Params('userId')))
```

---

## Reference

### `Params(key)`

Creates a reference expression that resolves to a route parameter from the current
request.

```typescript
function Params(key: string): ChainableRef
```

:::param
---
name: key
type: "string"
required: true
---
The route parameter name to reference. Must match a named segment in the route path.
Dot notation navigates into nested values if the parameter value is an object.
:::

#### Returns

A `ChainableRef` - an immutable expression builder you can use directly as a value or
chain with the methods below.

### Methods

#### `.path(key)`

Navigates deeper into the referenced value.

```typescript
path(key: string): ChainableRef
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
Params('caseId').path('length')
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
Params('caseId').pipe(
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
Params('caseId').nullish('Not provided')
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
Params('caseId').match(Condition.IsRequired())
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
Params('caseId').not.match(Condition.Equals(''))
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

### Pass a route parameter to an effect

Route parameters often identify which record to load:

```typescript
onAccess: [
  access({
    effects: [LoadCase(Params('caseId'))],
  }),
]
```

The effect receives the resolved `caseId` value from the URL.

### Display a route parameter

Use a reference directly in a component property or format expression:

```typescript
Format('Editing case %1', Params('caseId'))
```

### Test a route parameter

`.match()` tests the resolved value and returns a predicate:

```typescript
visibleWhen: Params('mode').match(Condition.Equals('edit'))
```

### Use a fallback for an absent value

Use `.nullish()` to supply a fallback when the reference resolves to `null` or
`undefined`:

```typescript
Params('section').nullish('overview')
```

This supplies a default when the matched route has no `section` parameter. It does
not change which route matches the URL.

Empty strings, `false`, and `0` keep their original value. Forge evaluates the fallback
only when the input is absent. You can also pass another reference or expression as
the fallback.

---

## Troubleshooting

### The parameter is always undefined

A missing route parameter resolves silently to `undefined`. Check that the parameter
name matches a named segment in the route path. `Params('caseId')` reads from a route
like `/case/:caseId` - if the route has no `:caseId` segment, the value is `undefined`.
