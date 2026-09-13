---
title: validation()
slug: validation
section: reference
path: reference/validation
nav: Authoring API/Validation
order: 70
description: Creates a validation rule from a condition or a generator function
teaches: [validation, validWhen, groups, submissionOnly, details, ValidationFunctionResult]
prerequisites: [field, step]
related:
  reference: condition, generator, self, answer, submit
---

# `validation()`

`validation()` creates a rule you add to a [field's](./field) or [step's](./step) `validWhen` array. It
has two forms: a **condition-backed** form that pairs a predicate with a message, and
a **function-backed** form that delegates to a generator function.

```typescript
import { validation } from '@ministryofjustice/hmpps-forge/core/authoring'

// Condition-backed: one predicate, one message
validation({
  condition: Self().match(Condition.IsRequired()),
  message: 'Enter your email address',
})

// Condition-backed: cross-field check at the step level
validation({
  condition: Answer('endDate').match(
    Condition.Date.IsAfter(Answer('startDate'))
  ),
  message: 'End date must be after the start date',
})

// Function-backed: a generator that returns multiple errors
validation({
  function: ValidateDate(Self()),
})
```

The two forms are mutually exclusive. A rule has either `condition` and `message`, or
`function`, never both. Every active rule runs, and every failure is collected.

---

## Reference

### `validation(options)`

Creates a validation rule from an options object. The options follow one of two forms.

**Condition-backed** - a predicate paired with a message:

```typescript
function validation(options: {
  condition: PredicateExpr,
  message: ResolvableString,
  submissionOnly?: boolean,
  groups?: string[],
  details?: Record<string, unknown>,
}): ValidationExpr
```

**Function-backed** - a generator function that returns errors:

```typescript
function validation(options: {
  function: GeneratorFunctionExpr,
  submissionOnly?: boolean,
  groups?: string[],
}): ValidationExpr
```

The two forms are mutually exclusive. Do not combine `condition`/`message` with
`function` in the same rule.

#### Condition-backed options

:::param
---
name: condition
type: "PredicateExpr"
required: true
---
The predicate that must be true for the input to be valid. This is what `.match()` on
a reference produces, or a combinator built with [`and()`](./and),
[`or()`](./or), [`not()`](./not), or
[`xor()`](./xor).

Use [`Self()`](./self) in field-level rules to test the field's own value.
Use [`Answer()`](./answer) in step-level rules to test across fields.
:::

:::param
---
name: message
type: "ResolvableString"
required: true
---
The error message to show when the condition fails. Accepts a plain string or an
expression that resolves to a string, such as
`Format('Enter a value for %1', Data('fieldLabel'))`.
:::

:::param
---
name: details
type: "Record<string, unknown>"
required: false
---
Metadata passed to the error handler. Use this to provide extra context about the
failure. For example, `{ field: 'month' }` tells the renderer which part of a
composite input to highlight.
:::

#### Function-backed options

:::param
---
name: function
type: "GeneratorFunctionExpr"
required: true
---
A call to a [`generator()`](./generator)-registered function. The function
receives its arguments (resolved at request time) and returns a
`ValidationFunctionResult`: either `undefined` (valid) or an array of error objects.

Each error object has a `message` string and an optional `details` object:

```typescript
type ValidationFunctionResult = readonly ValidationFunctionError[] | undefined

interface ValidationFunctionError {
  message: string
  details?: Record<string, unknown>
}
```

Only a direct generator call is accepted. References, conditions, transformers, and
other expression types cannot be used as the `function` value.
:::

#### Shared options

:::param
---
name: submissionOnly
type: "boolean"
required: false
---
When `true`, the rule runs only on form submission. It does not run during navigation
or entry validation checks. Use this for rules that depend on a fresh submission, such
as length checks or async service lookups that do not apply when reviewing earlier
answers.
:::

:::param
---
name: groups
type: "string[]"
required: false
---
The validation groups this rule belongs to. Defaults to `['default']` when omitted.

Groups let you run different sets of rules for different submit actions. A [submit hook](./submit)
selects which groups to validate with `validate: { groups: ['address'] }`. Rules in
other groups are skipped for that submission.
:::

#### Returns

A `ValidationExpr` - an expression you add to a field's or step's `validWhen` array.

#### Caveats

- Default-group rules run on every request, journey-wide. The validities phase runs
  every step's default-group, non-`submissionOnly` rules on every request (GET and POST)
  to feed the reachability walk. An expensive condition in `validWhen` is a journey-wide
  per-request cost. Mark it `submissionOnly` or move it to a named group to exclude it.

- A condition evaluator that throws fails the request. It does not become the rule's
  validation message. An `inputSchema` mismatch on a condition returns `false` instead.

- All rules run. There is no short-circuit on first failure. Every active rule executes
  and every failure is collected.

- A rule with only a named group drops out of the default group. `groups: ['expensive']`
  means the rule will not run in the validities phase, under `validate: true`, or in
  `validateOnEntry` unless those explicitly select that group.

---

## Usage

### Test a field's own value

The most common use - check that a field has a value:

```typescript
GovUKTextInput({
  code: 'email',
  label: 'Email address',
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter your email address',
    }),
  ],
})
```

`Self()` refers to the field's own answer. The rule fails when the value is empty,
null, or undefined.

### Chain multiple rules

Add several rules to `validWhen`. They run in order:

```typescript
validWhen: [
  validation({
    condition: Self().match(Condition.IsRequired()),
    message: 'Enter your full name',
  }),
  validation({
    condition: Self().match(Condition.String.HasMinLength(3)),
    message: 'Name must be at least 3 characters',
    submissionOnly: true,
  }),
]
```

The length check has `submissionOnly: true`, so it runs only on form submission. When
the user navigates back to this step, only the required check runs.

### Use a dynamic error message

The `message` property accepts expressions. Use `Format()` to build the message from
resolved values:

```typescript
validation({
  condition: Self().match(Condition.Number.LessThanOrEqual(Data('maxFileSize'))),
  message: Format('File must be smaller than %1 MB', Data('maxFileSize')),
})
```

### Combine conditions with logic combinators

Build complex rules with [`and()`](./and), [`or()`](./or),
and [`not()`](./not):

```typescript
validation({
  condition: or(
    not(Self().match(Condition.IsRequired())),
    Self().match(Condition.Address.IsValidPostcode()),
  ),
  message: 'Enter a valid postcode',
})
```

This rule passes when the field is empty or when the value is a valid postcode. It
fails only when the value is present and invalid.

### Assign rules to validation groups

Use `groups` to control which rules run for each submit action:

```typescript
GovUKTextInput({
  code: 'postcode',
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter a postcode',
      groups: ['find-postcode'],
    }),
  ],
})

GovUKTextInput({
  code: 'addressLine1',
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter the first line of your address',
      groups: ['address'],
    }),
  ],
})
```

Each submit hook validates its own group:

```typescript
onSubmission: [
  submit({
    when: Post('action').match(Condition.Equals('find')),
    validate: { groups: ['find-postcode'] },
    onValid: { effects: [FindAddress(Answer('postcode'))] },
  }),
  submit({
    when: Post('action').match(Condition.Equals('save')),
    validate: { groups: ['address'] },
    onValid: {
      effects: [SaveAddress()],
      next: [redirect({ goto: 'confirmation' })],
    },
  }),
]
```

The "find" button validates only the postcode field. The "save" button validates only
the address fields.

### Validate across fields at the step level

Place a rule on the step's `validWhen` to compare two answers. Step-level failures
are domain errors - they belong to the page, not a specific field:

```typescript
step({
  validWhen: [
    validation({
      condition: Answer('endDate').match(
        Condition.Date.IsAfter(Answer('startDate'))
      ),
      message: 'End date must be after the start date',
    }),
  ],
  blocks: [startDateField, endDateField],
})
```

### Attach metadata to a failure

Use `details` to pass extra context to the error handler. A common use is telling the
renderer which part of a composite input failed:

```typescript
validWhen: [
  validation({
    condition: Self().path('day').match(Condition.Date.IsValidDay()),
    message: 'Enter a valid day',
    details: { field: 'day' },
  }),
  validation({
    condition: Self().path('month').match(Condition.Date.IsValidMonth()),
    message: 'Enter a valid month',
    details: { field: 'month' },
  }),
]
```

The `details` object is passed through to the error handler. The component can use it
to highlight the specific input that failed.

### Return multiple errors from a generator function

Use the `function` form when one rule needs to produce multiple errors. Define a
generator that returns a `ValidationFunctionResult`:

```typescript
const ValidateDate = generator('App.ValidateDate', {
  factory: () =>
    (date: { day?: string; month?: string; year?: string }): ValidationFunctionResult => {
      const errors: ValidationFunctionError[] = []

      if (!date.day) {
        errors.push({ message: 'Enter a day', details: { field: 'day' } })
      }
      if (!date.month) {
        errors.push({ message: 'Enter a month', details: { field: 'month' } })
      }
      if (!date.year) {
        errors.push({ message: 'Enter a year', details: { field: 'year' } })
      }

      return errors
    },
})
```

Pass the generator call as the `function` property:

```typescript
validWhen: [
  validation({ function: ValidateDate(Self()) }),
]
```

Return `undefined` or an empty array when the input is valid. Each error in the
returned array becomes a separate validation failure with its own message and details.

### Call an async service in a function-backed rule

A generator function can call an external service. Use `submissionOnly` to prevent the
service call during navigation:

```typescript
const ValidateReference = generator('App.ValidateReference', {
  factory: (deps: { referenceService: ReferenceService }) =>
    async (reference: string): Promise<ValidationFunctionResult> => {
      const isAvailable = await deps.referenceService.isAvailable(reference)

      if (isAvailable) {
        return
      }

      return [{ message: 'Enter a reference that is not already in use' }]
    },
})
```

```typescript
validWhen: [
  validation({
    function: ValidateReference(Self()),
    submissionOnly: true,
    groups: ['check-reference'],
  }),
]
```

The `submissionOnly` and `groups` options work the same way on function-backed rules
as on condition-backed rules. The generator function does not run when the rule is
inactive.

---

## Troubleshooting

### The validation rule never fails

Check that the condition tests the right value. A common mistake is testing
`Answer('fieldCode')` when the rule sits on the field itself. Use `Self()` for
field-level rules - it refers to the field's own answer without repeating the code.

### A rule runs during navigation but it should not

Add `submissionOnly: true` to the rule. Without this flag, rules run on every request,
including GET requests when the user navigates to the step. A rule that depends on a
fresh submission (such as a length check) can fail unexpectedly when the user returns
to an earlier step.

### Step-level failures do not appear

Step-level rules produce domain validation errors. These errors belong to the page as
a whole, not a specific field. Check that your page layout renders domain errors - they
appear separately from field-level errors.

### A rule runs for the wrong submit action

Use `groups` to separate rules by submit action. Without groups, all rules belong to
the `'default'` group. A submit hook with `validate: true` runs the default group. A
hook with `validate: { groups: ['address'] }` runs only the address group. Make sure
each rule is in the right group for its submit action.

### A function-backed rule throws a TypeError

The generator function must return `undefined` or an array of error objects. Each error
object must have a `message` string and an optional `details` object. No other keys
are allowed on the error object. If the return value does not match this shape, the
runtime throws a `TypeError`.

### Mixing condition and function in one rule

A validation rule accepts either `condition` and `message`, or `function`, not both.
If you combine them, the DSL validator reports an error. Split them into separate
rules.
