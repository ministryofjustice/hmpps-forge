---
title: Format
section: authoring-language
path: authoring-language/format
teaches: [Format, string-interpolation, placeholders]
prerequisites: [Answer, Data, Item]
---

<p class="govuk-caption-xl">Expressions</p>

# Format

`Format()` builds strings from a template and a set of dynamic
values. It's how you compose text that includes references,
conditional content, or computed values without resorting to raw
string concatenation.

{{slot:toc}}

---

## What is Format?

`Format()` takes a template string with numbered placeholders and
replaces each one with the corresponding argument. Placeholders use
`%1`, `%2`, `%3` and so on, starting from 1.

```typescript
import { Format } from '@ministryofjustice/hmpps-forge/core/authoring'

Format('Hello, %1!', Answer('fullName'))
```

If `Answer('fullName')` resolves to `'Alice'`, the result is
`'Hello, Alice!'`.

Arguments can be any expression: references like `Answer()` and
`Data()`, conditional expressions like `match()` and
`when().then().else()`, piped transformations, or static strings.
They are all resolved before being substituted into the template.

---

## How it works

Forge evaluates each argument to a concrete value, then substitutes
them into the template by position. `%1` is replaced by the first
argument, `%2` by the second, and so on.

---

## Using in your definitions

### Display text

The simplest use is inserting an answer into a sentence:

```typescript
GovUKBody({
  text: Format('We have sent a confirmation email to %1.', Answer('email')),
})
```

### Multiple placeholders

A single `Format()` can combine several values:

```typescript
GovUKPanel({
  titleText: 'Appointment booked',
  html: Format(
    'Your %1 appointment has been booked for %2 at %3.',
    Answer('appointmentType'),
    Answer('appointmentDate').pipe(
      Transformer.String.ToDate(),
      Transformer.Date.Format('D MMMM YYYY'),
    ),
    Answer('appointmentTime'),
  ),
})
```

### Conditional arguments

Arguments can themselves be conditional expressions. A `match()`
inside a `Format()` lets you vary part of the string based on an
answer:

```typescript
Format(
  'Email (%1)',
  Answer('email'),
)

Format(
  'Contact: %1',
  match(Answer('contactMethod'))
    .branch(Condition.Equals('email'), Answer('email'))
    .branch(Condition.Equals('phone'), Answer('phoneNumber'))
    .otherwise(''),
)
```

### Dynamic URLs and field codes

`Format()` is commonly used to build URLs for links and redirects:

```typescript
redirect({
  goto: Format('../%1/add-steps', Data('goalUuid')),
})
```

And to generate dynamic field codes inside iterators:

```typescript
GovUKSelectInput({
  code: Format('step_actor_%1', Item().index()),
  defaultValue: Item().path('actor'),
})
```

---

## API surface

### `Format(template, ...args)`

Builds a string by substituting arguments into a template.

```typescript
import { Format } from '@ministryofjustice/hmpps-forge/core/authoring'
```

`template` is a string containing `%1`, `%2`, etc. placeholders.
Each `arg` is an expression or static value that replaces the
corresponding placeholder.

Returns a value expression (not a chainable reference).

---

## Best practices

- **Keep templates readable.** If a template has more than three or
  four placeholders, consider whether the string should be built
  differently or whether the data should be reshaped in an effect.
- **Use `Format()` for URLs and field codes, not just display text.**
  Dynamic redirect paths and iterator-generated field codes are
  common uses that are easy to overlook.
- **Prefer `Format()` over HTML string building.** When you need
  dynamic content inside HTML, `Format()` with placeholders is
  clearer than concatenating strings with expression results.
