---
title: Answer()
slug: answer
section: reference
path: reference/answer
nav: Authoring API/References
order: 51
description: Creates a reference to an answer collected by a field
teaches: [answer, references, expressions, pipe, match, path, nullish, absent-values]
prerequisites: [field, step]
related:
  reference: data, self, condition, transformer, iterator
  how-to: creating-your-own-custom-condition, creating-your-own-custom-transformer
---

# `Answer()`

`Answer()` creates a reference to an answer collected by a field. You use it wherever a
journey definition needs a value that somebody entered - in headings, validations,
visibility conditions, pipelines, and hooks.

```typescript
import { Answer } from '@ministryofjustice/hmpps-forge/core/authoring'

// Display an answer
GovUKHeading({ text: Answer('firstName') })

// Test an answer
Answer('email').match(Condition.Email.IsValidEmail())

// Transform an answer
Answer('caseReference').pipe(NormaliseCaseReference())
```

Answers arrive from several places: the current form submission, or values that access
hook effects loaded with `context.setAnswer()` from your application's store.
`Answer()` reads from the same prepared record regardless of how the value arrived.

:::note
---
---
Access hooks must load previously saved answers back using their original field codes.
Reachability and resumability checks depend on those codes to determine which steps
have been completed and where a journey can resume from.
:::

---

## Reference

### `Answer(target)`

Creates a reference expression that resolves to a field's answer at request time.

```typescript
function Answer(
  target: string | FieldBlockDefinition | ResolvableString,
): ChainableRef
```

:::param
---
name: target
type: "string | FieldBlockDefinition | ResolvableString"
required: true
---
The answer to reference. Accepts three forms:

- **A string code** - the field's `code` value. Dot notation navigates into nested
  values: `Answer('address.postcode')` reads the `postcode` property from the `address`
  answer.
- **A field definition** - a field block object like `GovUKTextInput(...)`. The reference
  reads the field's code directly, so renaming the code updates the reference
  automatically.
- **An expression** - a dynamic code resolved at request time, such as
  `Answer(Data('activeFieldCode'))`.
:::

#### Returns

A `ChainableRef` - an immutable expression builder you can use directly as a value or
chain with the methods below.

Every chain step returns a new builder. A stored reference like
`const email = Answer('email')` can safely appear in multiple chains without
interference.

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
Answer('address').path('postcode')
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
Answer('email').pipe(
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
Answer('email').nullish('Not provided')
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
Answer('email').match(Condition.IsRequired())
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
Answer('email').not.match(Condition.Equals(''))
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

### Display an answer

Pass a reference directly to a component property:

```typescript
GovUKHeading({
  text: Answer('firstName'),
  size: 'l',
})
```

The heading displays whatever was entered in the `firstName` field.

### Navigate into a nested value

When an answer is an object, use dot notation to reach a property:

```typescript
Answer('address.postcode')
```

Each segment uses optional chaining, so a missing intermediate produces `undefined`
rather than an error. If `address` hasn't been answered yet, the whole expression is
absent.

`.path()` does the same thing and is useful when chaining after another operation:

```typescript
Answer('address').path('postcode')
```

### Transform an answer with a pipeline

Use `.pipe()` to reshape a value without changing the stored answer:

```typescript
Answer('caseReference').pipe(NormaliseCaseReference('-'))
```

Multiple transformers run in sequence:

```typescript
Answer('name').pipe(
  Transformer.String.Trim(),
  Transformer.String.ToUpperCase(),
)
```

The stored answer stays as entered. The pipeline produces a new value for the expression
that uses it.

### Test an answer with a condition

`.match()` tests the resolved value and returns a predicate:

```typescript
validWhen: [
  validation({
    condition: Answer('email').match(Condition.Email.IsValidEmail()),
    message: 'Enter a valid email address',
  }),
]
```

### Negate a condition

`.not` inverts the next `.match()`:

```typescript
when: Answer('status').not.match(Condition.Equals('closed'))
```

This is `true` when the status is anything other than `'closed'`.

### Reference a field definition

Pass a field block directly instead of repeating its code as a string:

```typescript
const emailField = GovUKTextInput({
  code: 'email',
  label: 'Email address',
})

// In another step:
GovUKSummaryList({
  rows: [
    {
      key: { text: 'Email' },
      value: { text: Answer(emailField) },
    },
  ],
})
```

If the field's code changes later, the reference updates with it.

### Use a fallback for an absent value

An absent answer resolves to `undefined`. Conditions return `false` and transformers
return `undefined` for either `null` or `undefined`, without calling their schemas or
evaluators.

Use `.nullish()` to supply a fallback for those absent values:

```typescript
Answer('nickname').nullish(Answer('firstName'))
```

This resolves to the nickname when it is present, and falls back to the first name
otherwise. An empty string remains an empty string. Use a [conditional
expression](./conditional) with `Condition.IsRequired()` when empty text should also
select the fallback.

---

## Troubleshooting

### JavaScript's ?? does not select the fallback

`Answer('nickname') ?? 'Not provided'` tests the builder object at definition time.
That object exists even when the answer will be absent during a request. Use
`Answer('nickname').nullish('Not provided')` so Forge tests the resolved answer.

### The answer is always undefined

Answers are set when a form is submitted, not when the page is first accessed. If you
reference an answer on the same step that collects it, the value won't exist during the
initial `GET` request.

Check that the field's `code` matches the string passed to `Answer()`. A mismatched code
silently produces `undefined` rather than throwing an error.

### Answer() passed to an access hook effect is always undefined

Answer preparation runs after access hooks have finished. This means `Answer()`
references in blocks, visibility conditions, and other expressions can read answers that
access hooks loaded - but access hooks themselves cannot use `Answer()` to read values
that earlier hooks set. If an access hook needs a value from another hook, use the
effect context's `getAnswer()` method instead.

### A dotted path returns undefined even though the answer exists

Dot notation navigates into the answer's value. `Answer('user.name')` reads the `name`
property of the `user` answer - it does not read an answer with the literal code
`user.name`. If the field code contains a dot, reference the field definition directly
instead: `Answer(userNameField)`.

### A pipeline after `.not` doesn't work

`.not` only affects the next `.match()`. To negate a condition after a pipeline, put
`.not` after `.pipe()`:

```typescript
// This works:
Answer('email').pipe(Transformer.String.Trim()).not.match(Condition.Equals(''))

// This doesn't - .pipe() isn't available after .not:
Answer('email').not.pipe(Transformer.String.Trim()).match(Condition.Equals(''))
```
