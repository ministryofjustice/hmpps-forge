---
title: Answer and Self
section: authoring-language
path: authoring-language/answer-and-self
teaches: [Answer, Self, field-reference, answer-reference]
prerequisites: [field, FieldBlockDefinition, code]
---

<p class="govuk-caption-xl">References</p>

# Answer and Self

Most properties in a Forge definition are static: a label's text, a
button's classes, a step's title. But some need to react to what the
user has entered. `Answer()` and `Self()` are how you bring user
input into your definitions, turning static properties into dynamic
ones.

{{slot:toc}}

---

## What are Answer and Self?

### Answer

Every field has a `code` that identifies its stored answer. When a
user fills in a text input with `code: 'fullName'`, their response
is stored under that code. `Answer('fullName')` creates a reference
to that stored value.

```typescript
import { Answer } from '@ministryofjustice/hmpps-forge/core/authoring'

Answer('fullName')
```

Alternatively, you can pass a field definition object directly.
`Answer(emailField)` extracts the `code`from the object and produces the
same reference as `Answer('email')`. This keeps the reference coupled
to the field, so renaming the code in one place updates both.

### Self

`Self()` references the current field's own answer. It's partly
convenience, saving you from repeating the field's code in every
rule, and partly about keeping references intact. Validation rules
that use `Self()` do not need to know the field's code.

```typescript
import { Self } from '@ministryofjustice/hmpps-forge/core/authoring'

Self()
```

Without `Self()`, validation rules would need
`Answer('fullName').match(...)`, coupling each rule to the field's
code. Rename the field or extract the rules into a shared validation
array, and they break. `Self()` resolves to whichever field it
belongs to, so the rules stay portable.

> `Self()` can only be used inside a field definition. Using it
> outside one produces a compile-time error.

---

## How it works

Both `Answer()` and `Self()` create reference expressions that Forge
resolves during evaluation. When Forge encounters
`Answer('fullName')`, it looks up `'fullName'` in the current set of
stored answers. If the user has entered a value, the expression
resolves to it. If not, it resolves to `undefined`.

`Self()` works the same way, but Forge fills in the field code
automatically. At compile time, it replaces `Self()` with a
reference to the containing field's code. At runtime it resolves
exactly as the equivalent `Answer()` call would.

Forge is stateless, so answers are only available if your effects
store and load them. A typical pattern is saving answers on
submission and restoring them on access:

```typescript
// In a submit hook effect
SaveAnswers: (deps) => async (context) => {
  const answers = context.getAnswers()
  await deps.store.save(context.sessionId, answers)
}

// In an access hook effect
LoadAnswers: (deps) => async (context) => {
  const answers = await deps.store.load(context.sessionId)
  for (const [code, value] of Object.entries(answers)) {
    context.setAnswer(code, value)
  }
}
```

See [Loading, saving and redirecting](../building-journeys/loading-saving-and-redirecting)
for common patterns.

---

## Using in your definitions

### Using Answer

Use `Answer()` to display values the user entered on earlier pages:

```typescript
GovUKSummaryList({
  rows: [
    {
      key: { text: 'Name' },
      value: { text: Answer('fullName') },
      actions: {
        items: [{ href: 'name', text: 'Change', visuallyHiddenText: 'name' }],
      },
    },
  ],
})
```

The same reference works in conditions. Show or hide a field based
on a previous answer, or branch to different steps after submission:

```typescript
// Show a field only when the user selected 'phone'
GovUKTextInput({
  code: 'phoneNumber',
  label: { text: 'Phone number' },
  visibleWhen: Answer('appointmentType').match(Condition.Equals('phone')),
  dependentWhen: Answer('appointmentType').match(Condition.Equals('phone')),
})
```

```typescript
// Route to different steps based on the answer
onSubmission: [
  submit({
    validate: true,
    onValid: {
      next: [
        redirect({
          when: Answer('appointmentType').match(Condition.Equals('in-person')),
          goto: 'location',
        }),
        redirect({ goto: 'choose-date' }),
      ],
    },
  }),
]
```

Because `Answer()` is just data, it composes freely with other
expressions. A confirmation page might combine `Answer()` with
`Format()` for interpolation, `match()` for conditional text, and
`.pipe()` for value transformation, all in a single block definition:

```typescript
GovUKPanel({
  titleText: 'Appointment booked',
  html: Format(
    'Your %1 appointment has been booked for %2 at %3.',
    match(Answer('appointmentType'))
      .branch(Condition.Equals('in-person'), 'in-person')
      .branch(Condition.Equals('phone'), 'phone')
      .branch(Condition.Equals('video'), 'video call')
      .otherwise(''),
    Answer('appointmentDate').pipe(
      Transformer.String.ToDate(),
      Transformer.Date.Format('D MMMM YYYY'),
    ),
    Answer('appointmentTime'),
  ),
})
```

Forge evaluates every expression in the block before passing it to
the component. The component receives concrete values, not
expressions. It never needs to know that the panel body was
assembled from three different field answers.

### Using Self

`Self()` is most commonly used in `validWhen` rules. Because it
resolves to whatever field it sits inside, validation rules stay
portable:

```typescript
GovUKTextInput({
  code: 'fullName',
  label: { text: 'Full name' },
  formatters: [Transformer.String.Trim()],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter your full name',
    }),
    validation({
      condition: Self().match(Condition.String.HasMaxLength(200)),
      message: 'Full name must be 200 characters or less',
    }),
  ],
})
```

Cross-field validation is where `Self()` and `Answer()` work side by
side. `Self()` references the field being validated, `Answer()`
references the field it's compared against:

```typescript
GovUKDateInputFull({
  code: 'tripReturnDate',
  fieldset: {
    legend: { text: 'When did you return to the UK?' },
  },
  validWhen: [
    validation({
      condition: Self().match(Condition.Date.IsAfter(Answer('tripDepartureDate'))),
      message: 'Return date must be after the departure date',
    }),
  ],
})
```

---

## Nested values

`Answer()` supports dot notation for reaching into nested values. If
a field stores an object, you can reference individual properties:

```typescript
Answer('address.postcode')
```

Forge splits the string on dots and walks the resulting path, so
`Answer('address.postcode')` is equivalent to
`Answer('address').path('postcode')`. The `.path()` method is
available on both `Answer()` and `Self()` and can be chained:

```typescript
Answer('user').path('address').path('city')
```

For static paths, dot notation in the argument reads more naturally.
`.path()` is more useful when building paths across multiple steps.

---

## API surface

### `Answer(target)`

Creates a reference to a field's stored answer.

```typescript
import { Answer } from '@ministryofjustice/hmpps-forge/core/authoring'
```

`target` can be a string code (`Answer('email')`), a string with dot
notation (`Answer('address.postcode')`), or a field definition object
(`Answer(emailField)`).

Returns a chainable reference that supports `.path()`, `.match()`,
`.pipe()`, and `.each()`.

### `Self()`

Creates a reference to the containing field's own answer. Takes no
arguments.

```typescript
import { Self } from '@ministryofjustice/hmpps-forge/core/authoring'
```

Returns the same chainable reference type as `Answer()`. Must be
used inside a field definition.

### `.path(key)`

Navigates to a nested property within the referenced value. Supports
dot notation and can be chained.

```typescript
Answer('address').path('postcode')
Self().path('day')
```

---

## Best practices

- **Use `Self()` in validation rules.** It decouples the rule from
  the field's code, so validation arrays can be extracted and reused
  across fields without modification.
- **Use `Answer()` for everything else.** Displaying values,
  conditional rendering, routing, cross-field validation: any time
  you need another field's answer.
- **Prefer string codes for simplicity.** The string form works
  across file boundaries without imports. Use the field definition
  form when you want the reference tightly coupled to the field
  object.
- **Use dot notation in the argument for static paths.**
  `Answer('address.postcode')` reads more naturally than
  `Answer('address').path('postcode')`.
