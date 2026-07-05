---
title: Conditionals
section: authoring-language
path: authoring-language/conditionals
teaches: [when, Conditional, match-expression, match-branch, conditional-values]
prerequisites: [Condition, match-method, Answer, Data]
---

<p class="govuk-caption-xl">Expressions</p>

# Conditionals

Conditionals produce different values based on conditions. Where
`.match()` produces a boolean and combinators compose booleans,
conditionals branch on a boolean to return one value or another.
They are how you make block properties, labels, text, and other
values vary based on user input.

{{slot:toc}}

---

## What is a conditional?

A conditional expression evaluates a condition and returns one of
two or more possible values. Forge provides three forms, each
suited to different situations:

- **`when().then().else()`** - fluent if/then/else for two branches
- **`Conditional()`** - object syntax for the same thing
- **`match().branch().otherwise()`** - multi-branch, like a switch

All three resolve to a concrete value at evaluation time. Forge
evaluates the conditions, picks the matching branch, and the result
is what the block or property receives.

---

## when().then().else()

The fluent form reads naturally for simple two-way branches:

```typescript
import { when } from '@ministryofjustice/hmpps-forge/core/authoring'

when(Answer('age').match(Condition.Number.GreaterThan(18)))
  .then('Adult')
  .else('Under 18')
```

The condition is any predicate expression. `.then()` is the value
when true, `.else()` is the value when false. Both branches can be
any value: strings, numbers, expressions, even other conditionals.

### Nested conditionals

Because `.then()` and `.else()` accept any value, you can nest
`when()` calls for multi-level logic:

```typescript
when(Answer('hasTravelled').match(Condition.Equals('yes')))
  .then(
    when(Answer('trips').pipe(Transformer.Array.Length()).match(Condition.Number.GreaterThan(5)))
      .then('Frequent traveller')
      .else('Occasional traveller'),
  )
  .else('Has not travelled')
```

For more than two or three branches, `match()` is usually clearer.

### Common uses

Dynamic labels:

```typescript
GovUKTextInput({
  code: 'postcode',
  label: {
    text: when(Answer('country').match(Condition.Equals('UK')))
      .then('Postcode')
      .else('ZIP or postal code'),
  },
})
```

Dynamic hint text:

```typescript
hint: {
  text: when(Answer('country').match(Condition.Equals('UK')))
    .then('For example, SW1A 1AA')
    .else('For example, 90210'),
}
```

---

## Conditional()

The object syntax does the same thing as `when().then().else()` but
in a different shape:

```typescript
import { Conditional } from '@ministryofjustice/hmpps-forge/core/authoring'

Conditional({
  when: Answer('country').match(Condition.Equals('UK')),
  then: 'Postcode',
  else: 'ZIP or postal code',
})
```

This form can be useful when the conditional is part of a larger
object structure and the fluent chaining would break the visual
flow.

---

## match().branch().otherwise()

For values that depend on multiple possible states, `match()` reads
like a switch statement:

```typescript
import { match } from '@ministryofjustice/hmpps-forge/core/authoring'

match(Answer('appointmentType'))
  .branch(Condition.Equals('in-person'), 'In-person appointment')
  .branch(Condition.Equals('phone'), 'Phone appointment')
  .branch(Condition.Equals('video'), 'Video call appointment')
  .otherwise('Appointment')
```

`match()` takes a reference as its subject. Each `.branch()` tests
the subject against a condition and returns the paired value if it
matches. `.otherwise()` provides a fallback when no branch matches.

Branches are evaluated in order. The first matching branch wins.

### In block properties

`match()` is commonly used for display values that vary based on
an answer:

```typescript
GovUKSummaryList({
  rows: [
    {
      key: { text: 'Contact method' },
      value: {
        text: match(Answer('contactMethod'))
          .branch(Condition.Equals('email'), Format('Email (%1)', Answer('email')))
          .branch(Condition.Equals('phone'), Format('Phone (%1)', Answer('phoneNumber')))
          .branch(Condition.Equals('text'), Format('Text message (%1)', Answer('mobileNumber')))
          .otherwise(''),
      },
    },
  ],
})
```

### As Format arguments

`match()` works as an argument to `Format()`, letting you vary
part of a string:

```typescript
GovUKPanel({
  titleText: 'Appointment booked',
  html: Format(
    'Your %1 appointment has been booked.',
    match(Answer('appointmentType'))
      .branch(Condition.Equals('in-person'), 'in-person')
      .branch(Condition.Equals('phone'), 'phone')
      .branch(Condition.Equals('video'), 'video call')
      .otherwise(''),
  ),
})
```

### Inside iterators

`match()` can branch on item properties within an `.each()`:

```typescript
match(Item().path('status'))
  .branch(Condition.Equals('ACTIVE'), 'Active')
  .branch(Condition.Equals('CLOSED'), 'Closed')
  .otherwise('Unknown')
```

---

## API surface

### `when(predicate)`

Creates a fluent conditional. Returns a builder with `.then(value)`
and `.else(value)` methods.

```typescript
import { when } from '@ministryofjustice/hmpps-forge/core/authoring'
```

### `Conditional({ when, then, else })`

Creates a conditional from an object. `when` is a predicate, `then`
and `else` are the branch values.

```typescript
import { Conditional } from '@ministryofjustice/hmpps-forge/core/authoring'
```

### `match(subject)`

Creates a multi-branch conditional. Returns a builder with
`.branch(condition, value)` and `.otherwise(value)` methods.

```typescript
import { match } from '@ministryofjustice/hmpps-forge/core/authoring'
```

Branches are evaluated in order. The first match wins.

---

## Best practices

- **Use `when()` for two branches, `match()` for three or more.**
  A single if/else is clearer with `when()`. Multiple branches are
  clearer with `match()`.
- **Always provide a fallback.** Use `.else()` on `when()` and
  `.otherwise()` on `match()` to handle unexpected values. Without
  them, `when()` falls back to `false` and `match()` to `undefined`.
- **Avoid deeply nested `when()` calls.** If you find yourself
  nesting more than two levels, `match()` or restructuring the data
  in an effect is usually clearer.
- **Use `Conditional()` when fluent chaining breaks readability.**
  Inside deeply nested object literals, the object form can be
  easier to follow than the fluent form.
