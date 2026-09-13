---
title: Post()
slug: post
section: reference
path: reference/post
nav: Authoring API/References
order: 55
description: References a value from the submitted request body
teaches: [post, references, request-body, actions]
prerequisites: [step, submit]
related:
  reference: answer, query, params
---

# `Post()`

`Post()` references a value from the submitted request body. You use it to read values
that arrived in the form submission but don't belong to a field - most commonly the
`action` value from a submit button.

```typescript
import { Post } from '@ministryofjustice/hmpps-forge/core/authoring'

// Route a submit hook based on which button was clicked
when: Post('action').match(Condition.Equals('save-draft'))

// Match a button action by prefix
when: Post('action').match(Condition.String.StartsWith('remove_'))
```

Field values also arrive through the request body, but they go through answer
preparation and are read with [`Answer()`](./answer). `Post()` is for non-field values
like buttons, hidden inputs, and other form data that sits outside the field system.

---

## Reference

### `Post(key)`

Creates a reference expression that resolves to a value from the submitted request body.

```typescript
function Post(key: string): ChainableRef
```

:::param
---
name: key
type: "string"
required: true
---
The request body key to reference. Dot notation navigates into nested values if the
body value is an object.
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
Post('address').path('postcode')
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
Post('email').pipe(
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
Post('email').nullish('Not provided')
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
Post('email').match(Condition.IsRequired())
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
Post('email').not.match(Condition.Equals(''))
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

### Test which button submitted the form

The most common use - check the `action` value from a submit button:

```typescript
onSubmission: [
  submit({
    when: Post('action').match(Condition.Equals('login-admin')),
    onAlways: { effects: [LoginAsAdmin()] },
  }),
  submit({
    when: Post('action').match(Condition.Equals('login-user')),
    onAlways: { effects: [LoginAsUser()] },
  }),
]
```

Each [submit hook](./submit) runs only when its button was the one that submitted the form.

### Match a value by prefix

When several values share a pattern, match the prefix:

```typescript
when: Post('action').match(Condition.String.StartsWith('remove_'))
```

This matches `remove_0`, `remove_1`, and any other button whose `action` value starts
with `remove_`.

### Transform a post value

Chain `.pipe()` to reshape the value before using it:

```typescript
Post('action').pipe(Transformer.String.Replace('remove_', ''))
```

This strips the `remove_` prefix, leaving just the identifier.

### Use a fallback for an absent value

Use `.nullish()` to supply a fallback when the reference resolves to `null` or
`undefined`:

```typescript
Post('action').nullish('continue')
```

This supplies an action value when the submitted body has no `action` key. The
fallback also applies when there is no submitted body, such as on a GET request.

Empty strings, `false`, and `0` keep their original value. Forge evaluates the fallback
only when the input is absent. You can also pass another reference or expression as
the fallback.

---

## Troubleshooting

### Post() is always undefined on a GET request

`Post()` reads the submitted request body. On a GET request, there is no submission, so
`Post()` values are `undefined`. This is expected - `Post()` is meaningful only during
form submission.

### Post() values do not survive to the next request

`Post()` reads the current request's body. That body exists only during the POST
request that submitted the form. When the user moves to the next page, there is no
POST body anymore - `Post()` resolves to `undefined`.

This matters for reachability and validation checks on earlier steps. Those checks
run on every request, not just the original submission. A condition that depends on
`Post()` works during the submission but fails on every request after that.

Use [`Answer()`](./answer) for field values that need to persist. Load saved answers
back through access hooks so that reachability and validation checks find them on
later requests.
