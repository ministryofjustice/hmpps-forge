---
title: Query()
slug: query
section: reference
path: reference/query
nav: Authoring API/References
order: 56
description: References a query-string parameter from the current URL
teaches: [query, references, query-string]
prerequisites: [step]
related:
  reference: params, post, data
---

# `Query()`

`Query()` references a query-string parameter from the current URL. You use it to read
values appended after the `?` in the URL, like the `returnTo` in
`/summary?returnTo=check-answers`.

```typescript
import { Query } from '@ministryofjustice/hmpps-forge/core/authoring'

// Redirect based on a query parameter
redirect({
  when: Query('returnTo').match(Condition.Equals('check-answers')),
  goto: 'check-answers',
})

// Resume a journey from a query flag
resumeWhen: Query('resume').match(Condition.Equals('true'))
```

---

## Reference

### `Query(key)`

Creates a reference expression that resolves to a query-string parameter from the
current request.

```typescript
function Query(key: string): ChainableRef
```

:::param
---
name: key
type: "string"
required: true
---
The query-string parameter name to reference. Dot notation navigates into nested values
if the parameter value is an object.
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
Query('filters').path('status')
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
Query('search').pipe(
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
Query('search').nullish('Not provided')
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
Query('search').match(Condition.IsRequired())
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
Query('search').not.match(Condition.Equals(''))
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
---
A repeated query key (like `?tag=a&tag=b`) can produce an array rather than a single
string. If the expression expects a string, test or transform the value before using it.
:::

---

## Usage

### Drive navigation with a query parameter

Query parameters can control where a step navigates after submission:

```typescript
redirect({
  when: Query('returnTo').match(Condition.Equals('check-answers')),
  goto: 'check-answers',
})
```

This sends the user to the check-answers step when the URL contains
`?returnTo=check-answers`.

### Test a query parameter in a condition

A query parameter can drive conditional logic:

```typescript
resumeWhen: Query('resume').match(Condition.Equals('true'))
```

### Test a query parameter for visibility

```typescript
visibleWhen: Query('debug').match(Condition.Equals('true'))
```

This makes the block visible only when `?debug=true` is in the URL.

### Use a fallback for an absent value

Use `.nullish()` to supply a fallback when the reference resolves to `null` or
`undefined`:

```typescript
Query('sort').nullish('name')
```

This uses `name` when the URL has no `sort` query parameter. An explicitly empty
`sort` value stays empty.

Empty strings, `false`, and `0` keep their original value. Forge evaluates the fallback
only when the input is absent. You can also pass another reference or expression as
the fallback.

---

## Troubleshooting

### The query parameter is always undefined

A missing query parameter resolves silently to `undefined`. Check that the parameter
name matches the key in the URL. `Query('returnTo')` reads from a URL like
`/summary?returnTo=check-answers` - if the query string has no `returnTo` key, the
value is `undefined`.
