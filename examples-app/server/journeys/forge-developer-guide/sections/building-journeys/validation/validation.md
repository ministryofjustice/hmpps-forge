---
title: Validation
section: building-journeys
path: building-journeys/validation
teaches: [validWhen, validation, ValidationExpr, ValidationFunctionResult, submissionOnly, groups, validation-groups, Self, formatters, Transformer, dependentWhen, cross-field-validation, validateOnEntry]
prerequisites: [step, StepDefinition, block, field, FieldBlockDefinition, onSubmission, submit]
---

<p class="govuk-caption-xl">Working with data</p>

# Validation

Forge validates form input declaratively. You attach rules to fields
that describe when the value is valid, and Forge evaluates those
rules during submission, collecting the results for the component to
render however it sees fit.

{{slot:toc}}

---

## What is a validation rule?

A validation rule can use either a condition and message, or a
generator-backed validation function. A condition must be true for
the field to be considered valid. When it evaluates to false, the
message is included in the validation result.

```typescript
import { validation, Self, Condition } from '@ministryofjustice/hmpps-forge/core/authoring'

validation({
  condition: Self().match(Condition.IsRequired()),
  message: 'Enter your email address',
})
```

This reads as: "the field is valid **when** its value is present."

Conditions use positive matching. They describe when the field
**is** valid, not when it is invalid. The only exception is when no
positive-form condition exists and you need to negate:

```typescript
validation({
  condition: Self().not.match(Condition.Date.IsFutureDate()),
  message: 'Date must be in the past',
})
```

**Forge's role stops at evaluation.** It checks the rules, collects
every failure, and hands the results to the component. Whether one
error or all errors are shown, how they are styled, where they
appear on the page - that is entirely the component's decision. The
validation system produces data; rendering consumes it.

---

## The submission pipeline

Validation is one stage in a larger pipeline that runs when a step
is submitted. Forge processes each field through a fixed sequence:

```
POST received
 |
 |-- for each field:
 |    |
 |    1. Capture       Raw value from the POST body
 |    2. Format        Run the field's formatters in sequence
 |    3. Dependency    Evaluate dependentWhen; clear value if false
 |
 +-- Submit hook
      |
      1. onAlways      Run effects that should always execute
      2. Validate      Evaluate validWhen rules for the requested groups
      3. Branch        Run onValid or onInvalid based on the result
```

Each stage feeds into the next. Formatters clean the value before
validation sees it. `dependentWhen` can remove a field from
validation entirely. Validation runs inside the matched submit
hook, after `onAlways` effects but before `onValid`/`onInvalid`
branching. This means effects in `onAlways` can set up data that
validation depends on.

### When validation runs

On both GET and POST requests, Forge re-validates all the steps
leading up to the current page to confirm the user can legitimately
reach it. These traversal checks use the same rules with one
difference: rules marked `submissionOnly: true` are skipped.

Validation of the current page only runs on POST, and only when the
matched submit hook has `validate` set to `true` or
`{ groups: [...] }`. This is the full pipeline shown above -
capturing values, formatting, evaluating dependencies, and checking
the field and step rules for the requested groups.

For more on how Forge determines reachability, see
[Routing and entry points](routing-and-entry-points).

---

## The validation() builder

The `validation()` function creates a validation rule for use in
`validWhen` arrays on fields and steps.

```typescript
import {
  validation, Self, Answer, Condition, Transformer,
  and, or, not,
} from '@ministryofjustice/hmpps-forge/core/authoring'
```

### condition

A predicate expression that must be true for the field to be valid.

Most conditions use `Self()`, which references the current field's
own value. It resolves automatically regardless of the field's code:

```typescript
validation({
  condition: Self().match(Condition.IsRequired()),
  message: 'Enter a value',
})
```

Use `Answer()` to reference another field's value for cross-field
rules:

```typescript
validation({
  condition: Self().match(Condition.Equals(Answer('email'))),
  message: 'Values do not match',
})
```

Conditions can be composed with `and`, `or`, `not`, and `xor` for
more complex rules. See [Complex conditions](#complex-conditions).

### message

The error message produced when the condition fails. This is passed
to the component as part of the validation result.

```typescript
validation({
  condition: Self().match(Condition.IsRequired()),
  message: 'Enter your full name',
})
```

`condition` and `message` are required together. Alternatively, use
`function` to return validation errors dynamically. The two forms
cannot be combined in one rule.

### function

A direct call to a custom generator that returns an array of
validation errors. Each error requires a `message` and can include a
`details` object. Returning `undefined` or an empty array means the
value is valid.

```typescript
import {
  generator,
  validation,
  Self,
  type ValidationFunctionResult,
} from '@ministryofjustice/hmpps-forge/core/authoring'

export const ValidateDate = generator('ValidateDate', {
  factory: () => (date: { day?: string; month?: string; year?: string }): ValidationFunctionResult => {
    const errors = []

    if (!date.day) {
      errors.push({ message: 'Enter a day', details: { field: 'day' } })
    }

    if (!date.month) {
      errors.push({ message: 'Enter a month', details: { field: 'month' } })
    }

    return errors
  },
})

validation({
  function: ValidateDate(Self()),
})
```

Forge preserves the returned array order and turns every item into a
failure for the field. The rule's `groups` and `submissionOnly`
settings are applied to every returned error; returned errors cannot
override them.

Only a direct `generator()` call is accepted. References, conditions,
transformers, pipelines, and other resolvable values cannot be used as
the `function` value. Arguments such as `Self()`, `Answer()`, and
`Data()` are resolved normally before the generator runs.

Generators can be asynchronous and can use injected read-only
dependencies. For example, a generator can ask a service whether a
reference is already in use:

```typescript
export const ValidateReference = generator<Dependencies>('ValidateReference', {
  factory: ({ referenceService }) => async (reference: string): Promise<ValidationFunctionResult> => {
    const isAvailable = await referenceService.isAvailable(reference)

    if (isAvailable) {
      return
    }

    return [{ message: 'Enter a reference that is not already in use' }]
  },
})

validation({
  function: ValidateReference(Self()),
  groups: ['check-reference'],
  submissionOnly: true,
})
```

Forge checks `groups`, `submissionOnly`, and the field's
`dependentWhen` before invoking the generator. This keeps inactive
and traversal-excluded functions from making service calls.

A validation function can also be used in a step's `validWhen` to
produce step-level errors:

```typescript
step({
  // ...
  validWhen: [
    validation({
      function: ValidateContactDetails(Answer('email'), Answer('phone')),
    }),
  ],
})
```

The return value is checked at runtime even when the generator has no
`outputSchema`. Returning `null`, a non-array, malformed error items,
or unsupported error properties causes evaluation to fail. Generator
exceptions also propagate because Forge has no returned message to
turn into a validation failure.

### submissionOnly (Optional)

When true, the rule is skipped during journey traversal checks and
only runs on actual submission.

```typescript
validation({
  condition: Self().match(Condition.IsRequired()),
  message: 'Select a country',
  submissionOnly: true,
})
```

This is useful for:

- expensive operations like API calls or uniqueness checks
- time-sensitive conditions such as "must be a future date", which
  could fail on a previously valid step if the user returns days
  later
- fields whose answers are reshaped or cleared by effects after
  submission, such as collecting individual fields into a different
  structure, where traversal would re-validate the now-empty
  originals and block access to later steps

### groups (Optional)

Assigns the rule to one or more named validation groups. When
omitted, the rule belongs to the `'default'` group.

```typescript
validation({
  condition: Self().match(Condition.IsRequired()),
  message: 'Enter a postcode',
  groups: ['find-postcode'],
})
```

Groups let you validate subsets of a step's fields independently.
A submit hook chooses which groups to validate by passing
`validate: { groups: ['group-name'] }`. Only rules belonging to
one of the requested groups will run. See
[Validation groups](#validation-groups) for the full pattern.

### details (Optional)

Arbitrary metadata passed through to the component alongside the
validation result. Forge does not interpret this object. A component
might use it to highlight a specific sub-field of a composite input,
apply styling, or attach additional context to the error.

```typescript
validation({
  condition: not(
    and(
      Self().match(Condition.Object.IsObject()),
      Self().not.match(Condition.Object.PropertyHasValue('day')),
    ),
  ),
  message: 'Date must include a day',
  details: { field: 'day' },
})
```

---

## Field-level validation

Fields define validation through the `validWhen` property, an array
of validation rules. Rules are evaluated in array order and
all failures are collected:

```typescript
GovUKTextInput({
  code: 'fullName',
  label: 'Full name',
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
    validation({
      condition: Self().match(Condition.String.LettersWithSpaceDashApostrophe()),
      message: 'Full name must only include letters, spaces, hyphens and apostrophes',
    }),
  ],
})
```

Because `validWhen` is a plain array, you can extract and spread
reusable rule sets:

```typescript
const requiredDate: ValidationExpr[] = [
  validation({
    condition: Self().match(Condition.IsRequired()),
    message: 'Enter a date',
  }),
  validation({
    condition: Self().match(Condition.Date.IsValid()),
    message: 'Enter a valid date',
  }),
]

MOJDatePicker({
  code: 'startDate',
  validWhen: [
    ...requiredDate,
    validation({
      condition: Self().match(Condition.Date.IsFutureDate()),
      message: 'Start date must be in the future',
    }),
  ],
})
```

Component packages can provide their own helpers that return
arrays of rules for common validation patterns. These are
just functions that build rule arrays - there is no special mechanism
involved.

---

## Formatters and validation

Formatters normalise submitted values before validation sees them.
They are defined on the field with the `formatters` property and run
in sequence during the submission pipeline, after the raw value is
captured but before any rules are evaluated.

```typescript
GovUKTextInput({
  code: 'email',
  label: 'Email address',
  formatters: [Transformer.String.Trim(), Transformer.String.ToLowerCase()],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter your email address',
    }),
  ],
})
```

Here `Transformer.String.Trim()` runs first, then
`Transformer.String.ToLowerCase()`. Validation then runs against
the final formatted value. Without the trim, a value of `"   "`
would pass `IsRequired()`.

Formatters only run on submission. They do not affect the value on
page load.

### Type conversion

Formatters also bridge the gap between what a component submits and
what validation conditions expect. Date conditions like
`Condition.Date.IsValid()` operate on ISO date strings, but
components may submit different formats:

```typescript
// A date picker submitting DD/MM/YYYY
formatters: [Transformer.String.ToISODate()]

// A three-part input submitting { day, month, year }
formatters: [Transformer.Object.ToISO({ year: 'year', month: 'month', day: 'day' })]
```

Without the formatter, the condition would receive the raw input and
could not interpret it correctly. The formatter converts it to the
format the condition expects.

---

## Conditional validation with dependentWhen

The `dependentWhen` property controls whether a field participates
in the validation pipeline at all. When its condition evaluates to
false, Forge skips all validation for the field and clears its
stored answer.

```typescript
GovUKTextInput({
  code: 'phoneNumber',
  label: 'Phone number',
  visibleWhen: Answer('contactMethod').match(Condition.Equals('phone')),
  dependentWhen: Answer('contactMethod').match(Condition.Equals('phone')),
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter your phone number',
    }),
  ],
})
```

### How dependentWhen differs from visibleWhen

These two properties serve different purposes in the pipeline.

`visibleWhen` controls rendering only. When false, the block's HTML
is not emitted. But the field still sits in the validation pipeline.
A hidden field with an `IsRequired()` rule will still produce a
validation failure.

`dependentWhen` sits between formatting and validation in the
submission pipeline. When false, two things happen: the field's
stored answer is cleared, and validation is skipped entirely. The
field is treated as though it does not exist for that submission.

The answer clearing is important. It prevents stale data from
surviving when a user changes an earlier answer. If someone selects
"Phone" and enters a number, then changes to "Email", the phone
number is cleared rather than silently persisting in the session.

Use both together when a conditional field has validation rules:
`visibleWhen` hides it from the page, `dependentWhen` removes it
from the pipeline.

### Nested conditional fields

Some components support nested fields that appear when a specific
option is selected, such as a text input revealed under a radio
option. These nested fields need `dependentWhen` just like
standalone conditional fields:

```typescript
GovUKRadioInput({
  code: 'tripReason',
  fieldset: { legend: { text: 'Reason for trip' } },
  items: [
    { value: 'holiday', text: 'Holiday' },
    { value: 'work', text: 'Work' },
    {
      value: 'other',
      text: 'Other',
      block: GovUKTextareaInput({
        code: 'tripDetails',
        label: { text: 'Give details' },
        dependentWhen: Answer('tripReason').match(Condition.Equals('other')),
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Enter details about your trip',
          }),
        ],
      }),
    },
  ],
})
```

Without `dependentWhen`, selecting "Holiday" would fail validation
on the details field because its `IsRequired()` rule would still
run.

---

## Step-level validation

Steps can define their own `validWhen` array. These rules run after
all field-level validation and apply to the step as a whole rather
than to any individual field:

```typescript
step({
  path: '/contact',
  title: 'Contact details',
  blocks: [emailField, phoneField, addressField, continueButton],
  validWhen: [
    validation({
      condition: or(
        Answer('email').match(Condition.IsRequired()),
        Answer('phone').match(Condition.IsRequired()),
        Answer('address').match(Condition.IsRequired()),
      ),
      message: 'Provide at least one contact method',
    }),
  ],
  onSubmission: [
    submit({ validate: true, onValid: { next: [redirect({ goto: 'next' })] } }),
  ],
})
```

Use step-level validation for constraints that span multiple fields,
where no single field owns the rule. "At least one of these three
fields must be filled" is a step-level concern. "This field must not
be empty" is a field-level concern.

---

## Validation groups

By default, every validation rule belongs to the `'default'`
group. When a submit hook sets `validate: true`, Forge validates
the `'default'` group - which means every rule that does not
specify a `groups` property.

You can assign rules to named groups and have different submit
hooks validate different groups. This is useful when a single
step has multiple buttons that should each validate a different
subset of fields.

### Assigning rules to groups

Add a `groups` array to a validation rule to place it in one or
more named groups:

```typescript
validation({
  condition: Self().match(Condition.IsRequired()),
  message: 'Enter a postcode',
  groups: ['lookup'],
})
```

A rule can belong to multiple groups:

```typescript
validation({
  condition: Self().match(Condition.IsRequired()),
  message: 'Enter your email',
  groups: ['contact', 'newsletter'],
})
```

Rules without a `groups` property belong to `'default'`. Rules
with an explicit `groups` array do **not** belong to `'default'`
unless you include it:

```typescript
// Only in 'lookup' - not validated by validate: true
groups: ['lookup']

// In both 'lookup' and 'default'
groups: ['lookup', 'default']
```

### Validating groups in submit hooks

Pass `validate: { groups: [...] }` to tell a submit hook which
groups to validate:

```typescript
onSubmission: [
  submit({
    when: Post('action').match(Condition.Equals('find-address')),
    validate: { groups: ['find-postcode'] },
    onValid: {
      effects: [MyEffects.LookupAddress()],
    },
  }),
  submit({
    when: Post('action').match(Condition.Equals('continue')),
    validate: { groups: ['address'] },
    onValid: {
      effects: [MyEffects.SaveAnswers()],
      next: [redirect({ goto: 'next-step' })],
    },
  }),
]
```

When the user presses "Find address", only rules in the
`'find-postcode'` group run. When they press "Continue", only
rules in the `'address'` group run. Neither button triggers
validation of the other group's fields.

`validate: true` is equivalent to
`validate: { groups: ['default'] }`.

### When to use groups

Groups work well when a step has multiple actions that each need
their own validation scope:

- **Lookup + continue** - validate the search input on lookup,
  validate the result fields on continue.
- **Save draft + submit** - validate required fields only on
  final submission, skip them on draft save.
- **Multi-section forms** - validate each section independently
  with its own button.

For steps with a single submit button that validates everything,
groups are unnecessary. Leave `groups` off your rules and use
`validate: true`.

### Entry validation

Steps can validate specific groups when the page loads using
`validateOnEntry`. This runs validation on GET requests and
renders the page with any failures visible immediately, without
the user having to submit first.

```typescript
step({
  path: '/confirm',
  title: 'Confirm details',
  validateOnEntry: [
    { groups: ['eligibility'], when: true },
  ],
  blocks: [/* ... */],
  onSubmission: [/* ... */],
})
```

The `when` property controls whether entry validation runs. Set
it to `true` to always validate on entry, or pass a predicate to
validate conditionally.

---

## Complex conditions

Conditions can be composed using `and`, `or`, `not`, and `xor`
combinators, and values can be transformed with `.pipe()` before
testing. These are covered in depth in the Expressions section. A
quick example in a validation context:

```typescript
import { or } from '@ministryofjustice/hmpps-forge/core/authoring'

validation({
  condition: or(
    Self().match(Condition.Date.IsToday()),
    Self().match(Condition.Date.IsFutureDate()),
  ),
  message: 'Date must be today or in the future',
})
```

### Cross-field validation

Use `Answer()` to reference another field's value. Place
cross-field rules on the dependent field, not the source:

```typescript
// The confirmation field validates against the original
GovUKTextInput({
  code: 'confirmEmail',
  label: 'Confirm email address',
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Confirm your email address',
    }),
    validation({
      condition: Self().match(Condition.Equals(Answer('email'))),
      message: 'Email addresses do not match',
    }),
  ],
})

// A return date validates against the departure date
MOJDatePicker({
  code: 'returnDate',
  label: 'Return date',
  validWhen: [
    validation({
      condition: Self().match(Condition.Date.IsAfter(Answer('departureDate'))),
      message: 'Return date must be after the departure date',
    }),
  ],
})
```

---

## Validation and submit hooks

Validation results are consumed by submit hooks. For validation to
run, the matched submit hook must set `validate` to `true` or to a
group list:

```typescript
onSubmission: [
  submit({
    validate: true,
    onAlways: {
      effects: [MyEffects.LogSubmission()],
    },
    onValid: {
      effects: [MyEffects.SaveAnswers()],
      next: [redirect({ goto: 'next-step' })],
    },
    onInvalid: {
      effects: [MyEffects.TrackFailure()],
    },
  }),
]
```

When `validate` is `true` or `{ groups: [...] }`, the hook runs
`onAlways` first, then validates the requested groups and branches
on the result:

- `onAlways` runs before validation
- `onValid` runs when every rule in the requested groups passed
- `onInvalid` runs when any rule failed

Effects in each branch run before `next` outcomes are evaluated, so
data set by an effect is available when evaluating redirects.

If validation fails and no `onInvalid` outcome is defined, Forge
re-renders the page with the validation results available to
components.

When `validate` is false (the default), no validation runs and only
`onAlways` is available. This is useful for submissions that should
proceed without checking field values.

For full details on submit hooks, see
[Hooks and lifecycle](hooks-and-lifecycle) and
[Loading, saving and redirecting](loading-saving-and-redirecting).

---

## Best practices

- **Use `IsRequired()` for empty checks.** It handles strings, null,
  undefined, and empty arrays.
- **Add `Transformer.String.Trim()` to text fields.** Without it,
  whitespace-only values pass `IsRequired()`.
- **Pair `dependentWhen` with `visibleWhen` on conditional fields.**
  `visibleWhen` alone hides the field but does not skip validation.
- **Place cross-field validation on the dependent field.** The
  confirmation field validates against the original, not the other
  way around.
- **Use `submissionOnly` for traversal-sensitive rules.** Conditions
  that change over time or depend on expensive lookups.
- **Extract reusable rule arrays.** Common patterns like "required
  valid date" can be shared across fields by spreading a
  validation rule arrays into `validWhen`.
- **Use validation groups when a step has multiple actions.** If
  each button should validate a different set of fields, assign
  rules to named groups and use `validate: { groups: [...] }` on
  each submit hook.
- **Keep ungrouped rules for simple steps.** If you have a single
  submit button that validates everything, `validate: true` and
  no `groups` property is clearer than explicitly naming a group.
