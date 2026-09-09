---
title: Answer()
slug: answer
section: reference
path: reference/answer
nav: Authoring API/References
order: 51
description: Creates a reference to an answer collected by a field
teaches: [answer, references, expressions, pipe, match, path, absent-values]
prerequisites: [field, step]
related:
  reference: data, self, condition, transformer
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

Navigates deeper into the answer's value.

```typescript
path(key: string): ChainableRef
```

`Answer('address').path('postcode')` is equivalent to `Answer('address.postcode')`.
Use `.path()` when you need to navigate after another operation, or when building a
reference from parts.

#### `.pipe(...steps)`

Passes the answer through one or more [transformers](./transformer) in sequence.

```typescript
pipe(...steps: TransformerFunctionExpr[]): ChainableExpr
```

Each transformer receives the previous step's output:

```typescript
Answer('email').pipe(
  Transformer.String.Trim(),
  Transformer.String.ToLowerCase(),
)
```

When the answer is absent, the pipeline is skipped and the expression stays absent.

The returned expression continues the chain - you can call `.match()`, `.path()`,
`.pipe()`, or `.not` on the result.

#### `.match(condition)`

Tests the answer against a [condition](./condition). Returns a predicate rather than another chainable
reference.

```typescript
match(condition: ConditionFunctionExpr): PredicateTestExpr
```

The answer's resolved value is passed into the condition as its `value` argument:

```typescript
Answer('membershipNumber').match(IsValidMembershipNumber('standard'))
```

Use the result in `when`, `validWhen`, `visibleWhen`, or anywhere else a predicate is
accepted.

#### `.not`

Negates the next `.match()`. This is a property, not a method - no parentheses needed.

```typescript
Answer('status').not.match(Condition.Equals('closed'))
```

After `.not`, only `.match()` and another `.not` are available. You cannot `.pipe()` or
`.path()` after negation. `.not.not` cancels itself out.

#### `.each(iterator)`

Iterates over the answer when it contains an array or collection. Takes an iterator
configuration and returns a single item (for find) or an iterable (for map and filter).

See [`iterator`](./iterator) for configuration and usage.

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
  label: { text: 'Email address' },
})

// In another step:
GovUKSummaryListRow({
  key: 'Email',
  value: Answer(emailField),
})
```

If the field's code changes later, the reference updates with it.

### Use a fallback for an absent answer

An absent answer resolves to `undefined`. Conditions return `false` and transformers
return `undefined` for either `null` or `undefined`, without calling their schemas or
evaluators.

When you need a fallback, use a [conditional expression](./conditional):

```typescript
Conditional({
  when: Answer('nickname').match(Condition.IsRequired()),
  then: Answer('nickname'),
  else: Answer('firstName'),
})
```

This resolves to the nickname when one exists, and falls back to the first name.

---

## Troubleshooting

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
