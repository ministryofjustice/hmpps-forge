# Validation System

The form-engine uses a declarative validation system where you define conditions that trigger error messages. Validation rules specify *when* an error should appear and *what* message to display.

## How Validation Works

Each field can have a `validate` array containing validation rules. Each rule specifies:

- **when** - A predicate that, when `true`, triggers the error
- **message** - The error message to display

Think of it as: *"Show this error **when** this condition is true."*

### Import

```typescript
import {
  field, validation,
  Self, Answer,
  Condition,
  and, or, not
} from '@form-engine/form/builders'
```

---

## The validation() Builder

```typescript
validation({
  when: PredicateExpr,      // Required: condition that triggers the error
  message: string,          // Required: error message to display
  submissionOnly?: boolean, // Optional: only check at final submission
  details?: object,         // Optional: metadata for complex fields
})
```

### `when` (Required)

A predicate expression that, when **true**, triggers the error. Typically uses `Self()` to reference the current field's value with negative matching:

```typescript
// "Show error when value is NOT required (is empty)"
validation({
  when: Self().not.match(Condition.IsRequired()),
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
  when: Self().not.match(Condition.Custom.UniqueUsername()),
  message: 'This username is already taken',
  submissionOnly: true,
})
```

### `details` (Optional)

Metadata for error handling, particularly useful for composite fields like date inputs:

```typescript
validation({
  when: Self().path('month').not.match(Condition.Number.Between(1, 12)),
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
validate: [
  // 1. Required
  validation({
    when: Self().not.match(Condition.IsRequired()),
    message: 'Enter your age',
  }),

  // 2. Format
  validation({
    when: Self().not.match(Condition.Number.IsInteger()),
    message: 'Age must be a whole number',
  }),

  // 3. Business rule
  validation({
    when: Self().not.match(Condition.Number.Between(18, 120)),
    message: 'You must be between 18 and 120 years old',
  }),
]
```

---

## The "Negative Match" Pattern

Validation uses negative matching: *"show error when value is NOT valid"*.

```typescript
// DO: Negative match - "show error when NOT valid"
validation({
  when: Self().not.match(Condition.IsRequired()),
  message: 'Enter your email address',
})

// DON'T: Positive match (confusing - shows error when field IS valid)
validation({
  when: Self().match(Condition.IsRequired()),
  message: 'Enter your email address',
})
```

The only exception is checking for invalid states directly:

```typescript
// Checking for a positive invalid state (date IS in future)
validation({
  when: Self().match(Condition.Date.IsFutureDate()),
  message: 'Date of birth must be in the past',
})
```

---

## `Self()` vs `Answer()`

Use `Self()` when validating the current field - it's clearer and automatically resolves to the field's code:

```typescript
// DO: Use Self() for current field
validation({
  when: Self().not.match(Condition.IsRequired()),
  message: 'Enter your email',
})

// DON'T: Use Answer() for same field
validation({
  when: Answer('email').not.match(Condition.IsRequired()),
  message: 'Enter your email',
})
```

Use `Answer()` when referencing **other** fields:

```typescript
validation({
  when: Self().not.match(Condition.Equals(Answer('email'))),
  message: 'Email addresses do not match',
})
```

---

## Common Patterns

### Basic Field Validation

```typescript
field<GovUKTextInput>({
  variant: 'govukTextInput',
  code: 'email',
  label: 'Email address',
  validate: [
    validation({
      when: Self().not.match(Condition.IsRequired()),
      message: 'Enter your email address',
    }),
    validation({
      when: Self().not.match(Condition.Email.IsValidEmail()),
      message: 'Enter a valid email address',
    }),
  ],
})
```

### Confirm Field Matches

Ensure a confirmation field matches the original:

```typescript
// Original field
field<GovUKTextInput>({
  variant: 'govukTextInput',
  code: 'email',
  label: 'Email address',
  validate: [
    validation({
      when: Self().not.match(Condition.IsRequired()),
      message: 'Enter your email address',
    }),
  ],
})

// Confirmation field - validates against the original
field<GovUKTextInput>({
  variant: 'govukTextInput',
  code: 'confirmEmail',
  label: 'Confirm email address',
  validate: [
    validation({
      when: Self().not.match(Condition.IsRequired()),
      message: 'Confirm your email address',
    }),
    validation({
      when: Self().not.match(Condition.Equals(Answer('email'))),
      message: 'Email addresses do not match',
    }),
  ],
})
```

### Conditional Required Field

Make a field required only when another field has a specific value:

```typescript
// Trigger field
field<GovUKRadioInput>({
  variant: 'govukRadioInput',
  code: 'contactMethod',
  fieldset: { legend: { text: 'How should we contact you?' } },
  items: [
    { value: 'email', text: 'Email' },
    { value: 'phone', text: 'Phone' },
    { value: 'other', text: 'Other' },
  ],
})

// Dependent field - only shown and validated when 'other' is selected
field<GovUKTextInput>({
  variant: 'govukTextInput',
  code: 'otherContactMethod',
  label: 'Please specify',

  // Hide when contactMethod is NOT 'other'
  hidden: Answer('contactMethod').not.match(Condition.Equals('other')),

  // Only validate when contactMethod IS 'other'
  dependent: Answer('contactMethod').match(Condition.Equals('other')),

  validate: [
    validation({
      when: Self().not.match(Condition.IsRequired()),
      message: 'Enter your preferred contact method',
    }),
  ],
})
```

### Date Comparison

Ensure one date comes after another:

```typescript
field<GovUKDateInputFull>({
  variant: 'govukDateInputFull',
  code: 'startDate',
  fieldset: { legend: { text: 'Start date' } },
  validate: [
    validation({
      when: Self().not.match(Condition.IsRequired()),
      message: 'Enter a start date',
    }),
    validation({
      when: Self().not.match(Condition.Date.IsValid()),
      message: 'Enter a valid start date',
    }),
  ],
})

field<GovUKDateInputFull>({
  variant: 'govukDateInputFull',
  code: 'endDate',
  fieldset: { legend: { text: 'End date' } },
  validate: [
    validation({
      when: Self().not.match(Condition.IsRequired()),
      message: 'Enter an end date',
    }),
    validation({
      when: Self().not.match(Condition.Date.IsValid()),
      message: 'Enter a valid end date',
    }),
    validation({
      when: Self().not.match(Condition.Date.IsAfter(Answer('startDate'))),
      message: 'End date must be after the start date',
    }),
  ],
})
```

### Date in Past or Future

```typescript
// Date must be in the past (e.g., date of birth)
field<GovUKDateInputFull>({
  variant: 'govukDateInputFull',
  code: 'dateOfBirth',
  fieldset: { legend: { text: 'Date of birth' } },
  validate: [
    validation({
      when: Self().not.match(Condition.IsRequired()),
      message: 'Enter your date of birth',
    }),
    validation({
      when: Self().not.match(Condition.Date.IsValid()),
      message: 'Date of birth must be a real date',
    }),
    validation({
      // Positive match: show error when date IS in the future
      when: Self().match(Condition.Date.IsFutureDate()),
      message: 'Date of birth must be in the past',
    }),
  ],
})

// Date must be in the future (e.g., appointment)
field<GovUKDateInputFull>({
  variant: 'govukDateInputFull',
  code: 'appointmentDate',
  fieldset: { legend: { text: 'Appointment date' } },
  validate: [
    validation({
      when: Self().not.match(Condition.IsRequired()),
      message: 'Enter an appointment date',
    }),
    validation({
      when: Self().not.match(Condition.Date.IsFutureDate()),
      message: 'Appointment must be in the future',
    }),
  ],
})
```

### Checkbox Validation

At least one selection:

```typescript
field<GovUKCheckboxInput>({
  variant: 'govukCheckboxInput',
  code: 'interests',
  multiple: true,
  fieldset: { legend: { text: 'What are you interested in?' } },
  items: [
    { value: 'sports', text: 'Sports' },
    { value: 'music', text: 'Music' },
    { value: 'art', text: 'Art' },
  ],
  validate: [
    validation({
      when: Self().not.match(Condition.IsRequired()),
      message: 'Select at least one interest',
    }),
  ],
})
```

Maximum selections:

```typescript
field<GovUKCheckboxInput>({
  variant: 'govukCheckboxInput',
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
  validate: [
    validation({
      when: Self().not.match(Condition.IsRequired()),
      message: 'Select at least one priority',
    }),
    validation({
      when: Self().pipe(Transformer.Array.Length())
        .not.match(Condition.Number.LessThanOrEqual(3)),
      message: 'Select no more than 3 priorities',
    }),
  ],
})
```

### Complex Cross-Field Validation

Using combinators for complex conditions:

```typescript
import { and, or } from '@form-engine/form/builders'

// Phone number required if contact method is "phone" OR opted into SMS
field<GovUKTextInput>({
  variant: 'govukTextInput',
  code: 'phoneNumber',
  label: 'Phone number',
  validate: [
    validation({
      when: and(
        or(
          Answer('contactMethod').match(Condition.Equals('phone')),
          Answer('smsNotifications').match(Condition.Equals('yes'))
        ),
        Self().not.match(Condition.IsRequired())
      ),
      message: 'Enter a phone number',
    }),
    validation({
      when: and(
        Self().match(Condition.IsRequired()),
        Self().not.match(Condition.Phone.IsValidPhoneNumber())
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
  when: not(
    or(
      Answer('email').match(Condition.IsRequired()),
      Answer('phone').match(Condition.IsRequired()),
      Answer('address').match(Condition.IsRequired())
    )
  ),
  message: 'Provide at least one contact method',
})
```

---

## The `dependent` Property

Use `dependent` when a conditionally hidden field has validation. This applies to:

- Fields with `hidden` that also have `validate` rules
- Nested conditional fields inside GOV.UK Radio/Checkbox items

The `hidden` and `dependent` properties are typically logical opposites:

- `hidden`: "Hide this field when the condition is true"
- `dependent`: "Only validate this field when the condition is true"

### Standalone Conditional Fields

```typescript
// Field is hidden AND has validation → use dependent
field<GovUKTextInput>({
  code: 'otherMethod',
  hidden: Answer('contactMethod').not.match(Condition.Equals('other')),
  dependent: Answer('contactMethod').match(Condition.Equals('other')),
  validate: [
    validation({
      when: Self().not.match(Condition.IsRequired()),
      message: 'Enter your preferred contact method',
    }),
  ],
})

// Field is hidden but NO validation → dependent not needed
field<GovUKTextInput>({
  code: 'optionalNote',
  hidden: Answer('showNote').not.match(Condition.Equals('yes')),
  // No validate array, so no dependent needed
})
```

### Nested Conditional Fields in Radio/Checkbox Items

GOV.UK Radio and Checkbox components support conditional content that reveals additional fields when a specific option is selected. These nested fields also need `dependent` to ensure validation only runs when visible:

```typescript
field<GovUKRadioInput>({
  variant: 'govukRadioInput',
  code: 'contactMethod',
  fieldset: { legend: { text: 'How should we contact you?' } },
  items: [
    { value: 'email', text: 'Email' },
    { value: 'phone', text: 'Phone' },
    {
      value: 'other',
      text: 'Other',
      // Nested field appears when 'other' is selected
      block: field<GovUKTextInput>({
        variant: 'govukTextInput',
        code: 'otherContactMethod',
        label: 'Please specify your contact method',

        // dependent ensures validation only runs when 'other' is selected
        dependent: Answer('contactMethod').match(Condition.Equals('other')),

        validate: [
          validation({
            when: Self().not.match(Condition.IsRequired()),
            message: 'Enter your preferred contact method',
          }),
        ],
      }),
    },
  ],
})
```

Without `dependent`, the nested field would fail validation even when hidden (because the user selected a different radio option).

---

## When Validation Runs

### Regular Validation

By default, validation runs when the current step is submitted. All validation rules in the `validate` array are checked in order, and the first failing rule's message is displayed.

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
validate: [
  // 1. Required check first
  validation({
    when: Self().not.match(Condition.IsRequired()),
    message: 'Enter your email address',
  }),

  // 2. Format check second
  validation({
    when: Self().not.match(Condition.Email.IsValidEmail()),
    message: 'Enter a valid email address',
  }),

  // 3. Business rules last
  validation({
    when: Self().not.match(Condition.Equals(Answer('confirmEmail'))),
    message: 'Email addresses do not match',
  }),
]
```

### Use IsRequired() for Empty Checks

`Condition.IsRequired()` handles strings, null, undefined, and empty arrays:

```typescript
// DO: Use IsRequired
validation({
  when: Self().not.match(Condition.IsRequired()),
  message: 'Enter your full name',
})

// DON'T: Use String.IsEmpty (doesn't handle all cases)
validation({
  when: Self().match(Condition.String.IsEmpty()),
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
field<GovUKTextInput>({
  code: 'email',
  label: 'Email address',
  formatters: [
    Transformer.String.Trim(),
    Transformer.String.ToLowerCase(),
  ],
  validate: [
    validation({
      when: Self().not.match(Condition.IsRequired()),
      message: 'Enter your email address',
    }),
  ],
})
```

### Place Cross-Field Validation on the Dependent Field

```typescript
// Email field - only validates itself
field<GovUKTextInput>({
  code: 'email',
  validate: [
    validation({
      when: Self().not.match(Condition.IsRequired()),
      message: 'Enter your email address',
    }),
  ],
})

// Confirm field - validates against the source
field<GovUKTextInput>({
  code: 'confirmEmail',
  validate: [
    validation({
      when: Self().not.match(Condition.IsRequired()),
      message: 'Confirm your email address',
    }),
    validation({
      when: Self().not.match(Condition.Equals(Answer('email'))),
      message: 'Email addresses do not match',
    }),
  ],
})
```
