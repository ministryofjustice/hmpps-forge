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
Self().not.match(Condition.String.IsEmpty())
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

A `ChainableRef` - the same immutable expression builder that [`Answer()`](./answer)
returns. All the same methods are available: `.path()`, `.pipe()`, `.match()`, `.not`,
and `.each()`. See the [Answer() methods documentation](./answer#methods) for details.

---

## Usage

### Validate the current field

The most common use - check the field's own value in a validation rule:

```typescript
GovUKTextInput({
  code: 'email',
  label: { text: 'Email address' },
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
  label: { text: 'First name' },
  validWhen: [requiredText],
})

GovUKTextInput({
  code: 'lastName',
  label: { text: 'Last name' },
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
