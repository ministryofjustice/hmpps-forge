---
title: Self()
slug: self
section: reference
path: reference/self
nav: Authoring API/References
order: 52
description: References the current field's own answer without repeating its code
teaches: [self, references, field-scope, validation]
prerequisites: [field, answer]
related:
  reference: answer, condition, validation
  how-to: creating-your-own-custom-condition
---

# `Self()`

`Self()` references the enclosing field's own answer. You use it in [validations](./validation),
visibility conditions, and formatters where the value you're working with is the field
itself.

```typescript
import { Self } from '@ministryofjustice/hmpps-forge/core/authoring'

Self().match(Condition.IsRequired())
Self().not.match(Condition.Equals(''))
Self().pipe(Transformer.String.Trim()).match(Condition.IsRequired())
```

`Self()` is a specialised form of [`Answer()`](./answer). It resolves to the same value
as `Answer(thisField)` would, but without needing a reference to the field definition or
repeating its code as a string.

---

## Reference

### `Self()`

Creates a reference expression that resolves to the enclosing field's answer at request
time.

```typescript
function Self(): ChainableRef
```

`Self()` takes no parameters. It resolves at compile time to whichever field it sits
inside, so it works correctly even when the field's code is a dynamic expression.

#### Returns

A `ChainableRef` - an immutable expression builder you can use directly as a value or
chain with the methods below.

### Methods

These methods use the enclosing field's answer. Keep `Self()` inside that field's
expressions so Forge can resolve its scope.

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
Self().path('postcode')
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
Self().pipe(
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
Self().nullish('Not provided')
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
Self().match(Condition.IsRequired())
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
Self().not.match(Condition.Equals(''))
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

### Validate the current field

The most common use - check the field's own value in a validation rule:

```typescript
GovUKTextInput({
  code: 'email',
  label: 'Email address',
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter your email address',
    }),
    validation({
      condition: Self().match(Condition.Email.IsValidEmail()),
      message: 'Enter a valid email address',
    }),
  ],
})
```

`Self()` refers to the `email` answer here, but the validations don't mention `'email'`
anywhere. If you rename the field's code later, the validations still work.

### Transform before testing

Chain `.pipe()` and `.match()` to transform the value before a condition tests it:

```typescript
validation({
  condition: Self()
    .pipe(Transformer.String.Trim())
    .match(Condition.IsRequired()),
  message: 'Enter a value',
})
```

This trims whitespace before checking whether the field is empty, so a value of just
spaces fails the required check.

### Share a validation across fields

Because `Self()` binds to whichever field it sits inside, you can define a validation
once and attach it to several fields:

```typescript
const requiredText = validation({
  condition: Self().match(Condition.IsRequired()),
  message: 'This field is required',
})

GovUKTextInput({
  code: 'firstName',
  label: 'First name',
  validWhen: [requiredText],
})

GovUKTextInput({
  code: 'lastName',
  label: 'Last name',
  validWhen: [requiredText],
})
```

Each field resolves `Self()` to its own answer. The `firstName` field checks its own
value; the `lastName` field checks its own.

### Navigate into the field's value

When the field's answer is an object, use `.path()` to read a property:

```typescript
Self().path('postcode')
```

This reads the `postcode` property from the current field's answer.

### Use a fallback for an absent value

Use `.nullish()` to supply a fallback when the reference resolves to `null` or
`undefined`:

```typescript
Self().nullish('Not provided')
```

Use this expression inside the enclosing field, where `Self()` can resolve its
answer. The fallback supplies an expression value without setting the field answer.

Empty strings, `false`, and `0` keep their original value. Forge evaluates the fallback
only when the input is absent. You can also pass another reference or expression as
the fallback.

---

## Troubleshooting

### Self() used outside of a field block

`Self()` must sit inside a [field block](./field) - in its `validWhen`, `visibleWhen`, `formatters`,
or similar properties. Using it in a step-level `when` condition or in a block that isn't
a field produces a compile-time error:

```text
Self() reference used outside of a field block
```

Use [`Answer()`](./answer) with the field's code or definition to reference a field's
answer from outside that field.

### Self() inside the field's own code expression

A field's `code` property defines which answer `Self()` refers to. Using `Self()` inside
that `code` expression would be circular, so it produces a compile-time error:

```text
Self() cannot be used within the field's code expression
```
