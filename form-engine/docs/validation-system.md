# Validation System Documentation

## Overview
The form engine uses a structured validation system with `ValidationExpr` objects
that support both regular validations and submission-only validations. This
system allows for precise control over when validation rules are applied and provides
a clear separation between journey traversal validation and final submission validation.

## ValidationExpr Structure
Each validation rule is represented as a `ValidationExpr` with the following structure:

```typescript
interface ValidationExpr {
  type: 'validation'                    // Type identifier
  when: PredicateExpr                   // Condition that triggers validation failure
  message: string                       // Error message to display
  submissionOnly?: boolean              // Optional: only check at submission time
}
```

## Creating Validation Rules
Use the `validation()` builder function to create validation rules:

```typescript
import { validation, field } from '../builders'
import { Answer, Self } from '../helpers/referenceHelpers'
import { Condition } from '../conditions'

const emailField = field({
  code: 'email',
  variant: 'govukTextInput',
  label: 'Email address',
  validate: [
    validation({
      when: Self().not.match(Condition.IsRequired()),
      message: 'Enter your email address'
    }),
    validation({
      when: Self().not.match(Condition.Email.IsValid()),
      message: 'Enter a valid email address'
    })
  ]
})
```

## Validation Types

### Regular Validations
Regular validations are checked both during journey path traversal and at submission time.
These should be used for standard field validation like required fields, format validation, etc.

```typescript
validation({
  when: Self().not.match(Condition.IsRequired()),
  message: 'This field is required'
})
```

### Submission-Only Validations
Submission-only validations are marked with `submissionOnly: true` and are only checked
when the user submits the form, not during journey path traversal.
This is useful for validations that:

- Make external API calls (like username uniqueness checks)
- Depend on data that may change between form steps
- Are expensive to compute

```typescript
validation({
  when: Self().not.match(Condition.Username.IsUnique()),
  message: 'This username is already taken',
  submissionOnly: true
})
```

## Journey Path Traversal vs Submission
The form engine validates that users can legitimately reach each step by re-running
validations during journey path traversal. However, some validations (like external API calls)
should not be re-checked during this process:

### Journey Traversal Validation
- Checks basic field requirements and format
- Ensures user followed the correct path through the form
- Uses only validations where `submissionOnly` is false or undefined

### Submission Validation
- Runs ALL validation rules (both regular and submission-only)
- Performs final checks before data is processed
- Includes expensive operations like uniqueness checks

## Examples

### Basic Field Validation
```typescript
const nameField = field({
  code: 'full_name',
  variant: 'govukTextInput',
  label: 'Full name',
  validate: [
    validation({
      when: Self().not.match(Condition.IsRequired()),
      message: 'Enter your full name'
    }),
    validation({
      when: Self().not.match(Condition.String.HasMaxLength(100)),
      message: 'Name must be 100 characters or less'
    })
  ]
})
```

### Conditional Validation
```typescript
const ageField = field({
  code: 'age',
  variant: 'govukTextInput',
  label: 'Age',
  validate: [
    validation({
      when: Self().not.match(Condition.IsRequired()),
      message: 'Enter your age'
    }),
    validation({
      when: Self().not.match(Condition.Number.IsInteger()),
      message: 'Age must be a whole number'
    }),
    validation({
      when: Self().not.match(Condition.Number.IsBetween(16, 120)),
      message: 'Age must be between 16 and 120'
    })
  ]
})
```

### Mixed Regular and Submission-Only Validation
```typescript
const usernameField = field({
  code: 'username',
  variant: 'govukTextInput',
  label: 'Choose a username',
  validate: [
    // Regular validation - checked during traversal and submission
    validation({
      when: Self().not.match(Condition.IsRequired()),
      message: 'Enter a username'
    }),
    validation({
      when: Self().not.match(Condition.String.HasMinLength(3)),
      message: 'Username must be at least 3 characters'
    }),
    validation({
      when: Self().not.match(Condition.String.MatchesRegex(/^[a-zA-Z0-9_]+$/)),
      message: 'Username can only contain letters, numbers, and underscores'
    }),
    // Submission-only validation - only checked at final submission
    validation({
      when: Self().not.match(Condition.IsUniqueUsername()),
      message: 'This username is already taken',
      submissionOnly: true
    })
  ]
})
```

### Date Validation with Future Date Check
```typescript
const appointmentDateField = field({
  code: 'appointment_date',
  variant: 'govukDateInput',
  label: 'Preferred appointment date',
  validate: [
    validation({
      when: Self().not.match(Condition.Date.IsValid()),
      message: 'Enter a valid date'
    }),
    validation({
      when: Self().not.match(Condition.Date.IsFutureDate()),
      message: 'Appointment date must be in the future',
      submissionOnly: true  // Only check at submission as "future" changes over time
    })
  ]
})
```

## Best Practices

### When to Use Submission-Only Validations
Use `submissionOnly: true` for validations that:

1. **Make external API calls**: Uniqueness checks, service availability, etc.
2. **Time-dependent validations**: Future date checks, age calculations, etc.
3. **Expensive computations**: Complex calculations that shouldn't run repeatedly
4. **Dynamic data**: Validations against data that may change between form steps

### When to Use Regular Validations
Use regular validations (default behavior) for:

1. **Format validation**: Email format, phone numbers, postal codes
2. **Required field checks**: Basic field presence validation
3. **Static rules**: Length limits, character restrictions, etc.
4. **Cross-field validation**: Between fields that don't change during the journey

### Error Message Guidelines
- Use clear, specific error messages
- Follow GOV.UK Design System patterns for error messages (or have content designers write these!)
- Be consistent with terminology across your form
- Provide guidance on how to fix the error when possible

```typescript
// Avoid: Vague or technical
validation({
  when: Self().not.match(Condition.Email.IsValid()),
  message: 'Invalid format'
})

// Good: Specific and actionable
validation({
  when: Self().not.match(Condition.Email.IsValid()),
  message: 'Enter an email address in the correct format, like name@example.com'
})
```
