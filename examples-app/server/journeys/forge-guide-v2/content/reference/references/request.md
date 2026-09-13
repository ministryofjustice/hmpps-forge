---
title: Request
slug: request
section: reference
path: reference/request
nav: Authoring API/References
order: 58
description: References metadata from the current HTTP request
teaches: [request, references, headers, cookies, state]
prerequisites: [step, access]
related:
  reference: params, query, post
---

# `Request`

`Request` exposes metadata about the current HTTP request. You call one of its methods
to reference the URL, path, method, a header, a cookie, or adapter-managed state.

```typescript
import { Request } from '@ministryofjustice/hmpps-forge/core/authoring'

// Match the request path
Request.Path().match(Condition.Equals('/dashboard'))

// Read adapter state (for example, a CSRF token from Express res.locals)
Request.State('csrfToken')

// Check the HTTP method
Request.Method().match(Condition.Equals('POST'))
```

`Request` is an object with methods, not a function. You never write `Request()` -
you call a specific method like `Request.Path()` or `Request.Headers('accept')`.

---

## Reference

### References

These methods select values from the current request. Chain the methods below
to navigate, transform, or test the selected value.

#### `Request.Url()`

Resolves to the full URL of the current request.

```typescript
Request.Url(): ChainableRef
```

#### `Request.Path()`

Resolves to the pathname of the current request, without the query string.

```typescript
Request.Path(): ChainableRef
```

#### `Request.Method()`

Resolves to the HTTP method of the current request (`'GET'` or `'POST'`).

```typescript
Request.Method(): ChainableRef
```

#### `Request.Headers(name)`

Resolves to a request header value.

```typescript
Request.Headers(name: string): ChainableRef
```

:::param
---
name: name
type: "string"
required: true
---
The header name to reference. Used as-is - dot notation does not apply here.
:::

#### `Request.Cookies(name)`

Resolves to a cookie value from the request.

```typescript
Request.Cookies(name: string): ChainableRef
```

:::param
---
name: name
type: "string"
required: true
---
The cookie name to reference. Used as-is - dot notation does not apply here.
:::

#### `Request.State(key)`

Resolves to a value from the adapter's request state. In Express, this reads from
`res.locals`.

```typescript
Request.State(key: string): ChainableRef
```

:::param
---
name: key
type: "string"
required: true
---
The state key to reference. Dot notation navigates into nested values:
`Request.State('auth.userId')` reads the `userId` property from the `auth` state
entry.
:::

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
Request.State('user').path('name')
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
Request.Headers('x-case-reference').pipe(
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
Request.Headers('x-case-reference').nullish('Not provided')
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
Request.Headers('x-case-reference').match(Condition.IsRequired())
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
Request.Headers('x-case-reference').not.match(Condition.Equals(''))
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

### Test the request path

Use `.match()` to test the path against a condition:

```typescript
onAccess: [
  access({
    when: Request.Path().match(Condition.Equals('/case-management')),
    next: [redirect({ goto: 'dashboard' })],
  }),
]
```

### Read adapter state

If an adapter supplies a CSRF token in request state, reference it with
`Request.State()`:

```typescript
Request.State('csrfToken')
```

Use this reference in a component or renderer property that needs the token. Forge
resolves it from the adapter's request state during rendering; the reference does
not create a token or configure CSRF middleware.

### Test the HTTP method

```typescript
when: Request.Method().match(Condition.Equals('POST'))
```

### Use a fallback for an absent value

Use `.nullish()` to supply a fallback when the reference resolves to `null` or
`undefined`:

```typescript
Request.State('locale').nullish('en')
```

This uses `en` when the adapter has not supplied a locale in request state. It does
not change the adapter state.

Empty strings, `false`, and `0` keep their original value. Forge evaluates the fallback
only when the input is absent. You can also pass another reference or expression as
the fallback.

---

## Troubleshooting

### Request values are undefined in reachability expressions

`Request` references resolve at request time only. They are not available during
reachability evaluation, where no live HTTP request exists. Use [`Data()`](./data) or
[`Session()`](./session) for values that reachability expressions need.
