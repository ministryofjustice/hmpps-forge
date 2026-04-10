# Validation System

Forge uses a declarative validation system where you define conditions that describe when a field is valid. Validation rules specify *when* a field's value is acceptable and *what* error message to display if it isn't.

## How Validation Works

Each field can have a `validWhen` array containing validation rules. Each rule specifies:

- **condition** - A predicate that, when `true`, means the field is valid
- **message** - The error message to display when the condition is not met

Think of it as: *"This field is valid **when** this condition is true."*

### Import

```typescript
import {
  field, validation,
  Self, Answer,
  Condition,
  and, or, not
} from '@ministryofjustice/hmpps-forge/core/authoring'
```

---

## The validation() Builder

```typescript
validation({
  condition: PredicateExpr,   // Required: condition that means the field is valid
  message: string,            // Required: error message to display when invalid
  submissionOnly?: boolean,   // Optional: only check at final submission
  details?: object,           // Optional: metadata for complex fields
})
```

### `condition` (Required)

A predicate expression that, when **true**, means the field is valid. Typically uses `Self()` to reference the current field's value with positive matching:

```typescript
// "Field is valid when value is required (is not empty)"
validation({
  condition: Self().match(Condition.IsRequired()),
  message: 'Enter your email address',
})
```

### `message` (Required)

The error message shown to the user. Follow GOV.UK guidelines: be specific, tell users what to do, and avoid jargon.

```typescript
// DO: Specific and actionable
'Enter your email address'
'Enter a valid UK postcode'
'Select at least one option'
'Date of birth must be in the past'

// DON'T: Vague or technical
'This field is required'
'Invalid format'
'Validation failed'
```

### `submissionOnly` (Optional)

When `true`, validation only runs on final form submission, not during navigation. Use for:

- Expensive API calls (uniqueness checks)
- Time-sensitive validations (future date checks)
- Checks that depend on data that may change

```typescript
validation({
  condition: Self().match(Condition.Custom.UniqueUsername()),
  message: 'This username is already taken',
  submissionOnly: true,
})
```

### `details` (Optional)

Metadata for error handling, particularly useful for composite fields like date inputs:

```typescript
validation({
  condition: Self().path('month').match(Condition.Number.Between(1, 12)),
  message: 'Month must be between 1 and 12',
  details: { field: 'month' },  // Highlights the month input
})
```

---

## Validation Order

Rules are checked in array order. The **first failing rule's message** is shown. Order from most basic to most specific:

1. **Required** - Is the field empty?
2. **Format** - Is it the right type/format?
3. **Business rules** - Is the value valid for this context?

```typescript
validWhen: [
  // 1. Required
  validation({
    condition: Self().match(Condition.IsRequired()),
    message: 'Enter your age',
  }),

  // 2. Format
  validation({
    condition: Self().match(Condition.Number.IsInteger()),
    message: 'Age must be a whole number',
  }),

  // 3. Business rule
  validation({
    condition: Self().match(Condition.Number.Between(18, 120)),
    message: 'You must be between 18 and 120 years old',
  }),
]
```

---

## The "Positive Match" Pattern

Validation uses positive matching: *"field is valid when value IS valid"*.

```typescript
// DO: Positive match - "field is valid when value IS valid"
validation({
  condition: Self().match(Condition.IsRequired()),
  message: 'Enter your email address',
})

// DON'T: Negative match (confusing - field is valid when value is NOT required)
validation({
  condition: Self().not.match(Condition.IsRequired()),
  message: 'Enter your email address',
})
```

The only exception is checking for invalid states directly:

```typescript
// Checking for a negative invalid state (date is NOT in future)
validation({
  condition: Self().not.match(Condition.Date.IsFutureDate()),
  message: 'Date of birth must be in the past',
})
```

---

## `Self()` vs `Answer()`

Use `Self()` when validating the current field - it's clearer and automatically resolves to the field's code:

```typescript
// DO: Use Self() for current field
validation({
  condition: Self().match(Condition.IsRequired()),
  message: 'Enter your email',
})

// DON'T: Use Answer() for same field
validation({
  condition: Answer('email').match(Condition.IsRequired()),
  message: 'Enter your email',
})
```

Use `Answer()` when referencing **other** fields:

```typescript
validation({
  condition: Self().match(Condition.Equals(Answer('email'))),
  message: 'Email addresses do not match',
})
```

---

## Common Patterns

### Basic Field Validation

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

### Confirm Field Matches

Ensure a confirmation field matches the original:

```typescript
// Original field
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

// Confirmation field - validates against the original
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
```

### Conditional Required Field

Make a field required only when another field has a specific value:

```typescript
// Trigger field
GovUKRadioInput({
  code: 'contactMethod',
  fieldset: { legend: { text: 'How should we contact you?' } },
  items: [
    { value: 'email', text: 'Email' },
    { value: 'phone', text: 'Phone' },
    { value: 'other', text: 'Other' },
  ],
})

// Dependent field - only shown and validated when 'other' is selected
GovUKTextInput({
  code: 'otherContactMethod',
  label: 'Please specify',

  // Show when contactMethod IS 'other'
  visibleWhen: Answer('contactMethod').match(Condition.Equals('other')),

  // Only validate when contactMethod IS 'other'
  dependentWhen: Answer('contactMethod').match(Condition.Equals('other')),

  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter your preferred contact method',
    }),
  ],
})
```

### Date Comparison

Ensure one date comes after another:

```typescript
GovUKDateInputFull({
  code: 'startDate',
  fieldset: { legend: { text: 'Start date' } },
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter a start date',
    }),
    validation({
      condition: Self().match(Condition.Date.IsValid()),
      message: 'Enter a valid start date',
    }),
  ],
})

GovUKDateInputFull({
  code: 'endDate',
  fieldset: { legend: { text: 'End date' } },
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter an end date',
    }),
    validation({
      condition: Self().match(Condition.Date.IsValid()),
      message: 'Enter a valid end date',
    }),
    validation({
      condition: Self().match(Condition.Date.IsAfter(Answer('startDate'))),
      message: 'End date must be after the start date',
    }),
  ],
})
```

### Date in Past or Future

```typescript
// Date must be in the past (e.g., date of birth)
GovUKDateInputFull({
  code: 'dateOfBirth',
  fieldset: { legend: { text: 'Date of birth' } },
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter your date of birth',
    }),
    validation({
      condition: Self().match(Condition.Date.IsValid()),
      message: 'Date of birth must be a real date',
    }),
    validation({
      // Negative match: field is valid when date is NOT in the future
      condition: Self().not.match(Condition.Date.IsFutureDate()),
      message: 'Date of birth must be in the past',
    }),
  ],
})

// Date must be in the future (e.g., appointment)
GovUKDateInputFull({
  code: 'appointmentDate',
  fieldset: { legend: { text: 'Appointment date' } },
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter an appointment date',
    }),
    validation({
      condition: Self().match(Condition.Date.IsFutureDate()),
      message: 'Appointment must be in the future',
    }),
  ],
})
```

### Checkbox Validation

At least one selection:

```typescript
GovUKCheckboxInput({
  code: 'interests',
  multiple: true,
  fieldset: { legend: { text: 'What are you interested in?' } },
  items: [
    { value: 'sports', text: 'Sports' },
    { value: 'music', text: 'Music' },
    { value: 'art', text: 'Art' },
  ],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Select at least one interest',
    }),
  ],
})
```

Maximum selections:

```typescript
GovUKCheckboxInput({
  code: 'topPriorities',
  multiple: true,
  fieldset: { legend: { text: 'Select your top 3 priorities' } },
  hint: 'Choose up to 3 options',
  items: [
    { value: 'cost', text: 'Cost' },
    { value: 'quality', text: 'Quality' },
    { value: 'speed', text: 'Speed' },
    { value: 'reliability', text: 'Reliability' },
  ],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Select at least one priority',
    }),
    validation({
      condition: Self().pipe(Transformer.Array.Length())
        .match(Condition.Number.LessThanOrEqual(3)),
      message: 'Select no more than 3 priorities',
    }),
  ],
})
```

### Complex Cross-Field Validation

Using combinators for complex conditions:

```typescript
import { and, or } from '@ministryofjustice/hmpps-forge/core/authoring'

// Phone number required if contact method is "phone" OR opted into SMS
GovUKTextInput({
  code: 'phoneNumber',
  label: 'Phone number',
  validWhen: [
    validation({
      condition: or(
        not(or(
          Answer('contactMethod').match(Condition.Equals('phone')),
          Answer('smsNotifications').match(Condition.Equals('yes'))
        )),
        Self().match(Condition.IsRequired())
      ),
      message: 'Enter a phone number',
    }),
    validation({
      condition: or(
        Self().not.match(Condition.IsRequired()),
        Self().match(Condition.Phone.IsValidPhoneNumber())
      ),
      message: 'Enter a valid phone number',
    }),
  ],
})
```

### At Least One of Multiple Fields

```typescript
// Place this validation on the first field
validation({
  condition: or(
    Answer('email').match(Condition.IsRequired()),
    Answer('phone').match(Condition.IsRequired()),
    Answer('address').match(Condition.IsRequired())
  ),
  message: 'Provide at least one contact method',
})
```

---

## The `dependentWhen` Property

Use `dependentWhen` when a conditionally shown field has validation. This applies to:

- Fields with `visibleWhen` that also have `validWhen` rules
- Nested conditional fields inside GOV.UK Radio/Checkbox items

### Standalone Conditional Fields

```typescript
// Field is conditional AND has validation → use visibleWhen + dependentWhen
GovUKTextInput({
  code: 'otherMethod',
  visibleWhen: Answer('contactMethod').match(Condition.Equals('other')),
  dependentWhen: Answer('contactMethod').match(Condition.Equals('other')),
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter your preferred contact method',
    }),
  ],
})

// Field is conditional but NO validation → dependentWhen not needed
GovUKTextInput({
  code: 'optionalNote',
  visibleWhen: Answer('showNote').match(Condition.Equals('yes')),
  // No validWhen array, so no dependentWhen needed
})
```

### Nested Conditional Fields in Radio/Checkbox Items

GOV.UK Radio and Checkbox components support conditional content that reveals additional fields when a specific option is selected. These nested fields also need `dependentWhen` to ensure validation only runs when visible:

```typescript
GovUKRadioInput({
  code: 'contactMethod',
  fieldset: { legend: { text: 'How should we contact you?' } },
  items: [
    { value: 'email', text: 'Email' },
    { value: 'phone', text: 'Phone' },
    {
      value: 'other',
      text: 'Other',
      // Nested field appears when 'other' is selected
      block: GovUKTextInput({
        code: 'otherContactMethod',
        label: 'Please specify your contact method',

        // dependentWhen ensures validation only runs when 'other' is selected
        dependentWhen: Answer('contactMethod').match(Condition.Equals('other')),

        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Enter your preferred contact method',
          }),
        ],
      }),
    },
  ],
})
```

Without `dependentWhen`, the nested field would fail validation even when hidden (because the user selected a different radio option).

---

## When Validation Runs

### Regular Validation

By default, validation runs when the current step is submitted. All validation rules in the `validWhen` array are checked in order, and the first failing rule's message is displayed.

### submissionOnly Validation

When `submissionOnly: true` is set, the validation **only** runs when the current step is submitted - it's skipped during other operations like journey traversal validation (checking if users can legitimately reach a step).

Use `submissionOnly` for:
- Expensive API calls (e.g., uniqueness checks)
- Time-sensitive validations (e.g., "must be a future date" which changes over time)
- Checks that shouldn't block navigation through previously completed steps

---

## Best Practices

### Order Validations Correctly

Always: Required → Format → Business Rules

```typescript
validWhen: [
  // 1. Required check first
  validation({
    condition: Self().match(Condition.IsRequired()),
    message: 'Enter your email address',
  }),

  // 2. Format check second
  validation({
    condition: Self().match(Condition.Email.IsValidEmail()),
    message: 'Enter a valid email address',
  }),

  // 3. Business rules last
  validation({
    condition: Self().match(Condition.Equals(Answer('confirmEmail'))),
    message: 'Email addresses do not match',
  }),
]
```

### Use IsRequired() for Empty Checks

`Condition.IsRequired()` handles strings, null, undefined, and empty arrays:

```typescript
// DO: Use IsRequired
validation({
  condition: Self().match(Condition.IsRequired()),
  message: 'Enter your full name',
})

// DON'T: Use String.IsEmpty (doesn't handle all cases)
validation({
  condition: Self().not.match(Condition.String.IsEmpty()),
  message: 'Enter your full name',
})
```

### Write Actionable Error Messages

```typescript
// DO: Tell users what to do
'Enter your email address'
'Enter a date in the past'
'Select at least one option'

// DON'T: State what went wrong
'This field is required'
'Invalid date'
'Validation error'
```

### Use Formatters to Clean Input

Trim whitespace so `"  "` isn't considered valid:

```typescript
GovUKTextInput({
  code: 'email',
  label: 'Email address',
  formatters: [
    Transformer.String.Trim(),
    Transformer.String.ToLowerCase(),
  ],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter your email address',
    }),
  ],
})
```

### Place Cross-Field Validation on the Dependent Field

```typescript
// Email field - only validates itself
GovUKTextInput({
  code: 'email',
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter your email address',
    }),
  ],
})

// Confirm field - validates against the source
GovUKTextInput({
  code: 'confirmEmail',
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
```
