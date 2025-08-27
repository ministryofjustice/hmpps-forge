# Validation System

## Overview

The form engine uses a structured validation system with `ValidationExpr` objects
that support both regular validations and submission-only validations. This
system allows for precise control over when validation rules are applied and provides
a clear separation between journey traversal validation and final submission validation.

## ValidationExpr

Validation rules define conditions that determine when a field's value is invalid and should
display an error message to the user. They integrate seamlessly with the form engine's
predicate system and support enhanced error handling for complex field types.

### Structure

```typescript
interface ValidationExpr {
  type: 'validation'              // Type identifier
  when: PredicateExpr             // Condition that triggers validation failure
  message: string                 // Error message to display
  submissionOnly?: boolean        // Optional: only check at submission time
  details?: Record<string, any>   // Optional: enhanced error handling details
}
```

### Examples

```typescript
// Basic required field validation
validation({
  when: Self().not.match(Condition.IsRequired()),
  message: 'This field is required'
})

// Format validation with enhanced error details
validation({
  when: Self().not.match(Condition.Date.IsValid()),
  message: 'Enter a valid date',
  details: {
    field: 'day'  // Highlight specific sub-field in composite components
  }
})

// Submission-only validation for external API calls
validation({
  when: Self().not.match(Condition.Username.IsUnique()),
  message: 'This username is already taken',
  submissionOnly: true
})
```

### Concepts

#### `type`
All validation expressions are marked with `type: 'validation'` for identification during JSON parsing and processing.

#### `when`
The predicate expression that determines when validation should fail. This _often_ uses negative logic
(with `.not.match()`) to check for invalid conditions rather than valid ones. This approach allows
the system to identify and report specific validation failures.

#### `message`
The error message displayed to the user when validation fails. Should be clear, specific,
and actionable, following accessibility guidelines and design system patterns.

#### `submissionOnly`
When `true`, this validation is only checked at final form submission, not during journey
path traversal. This is essential for validations that:

- Make external API calls (like username uniqueness checks)
- Depend on data that may change between form steps
- Are expensive to compute and shouldn't run repeatedly
- Are time-dependent (like future date validations)

**Journey Path Traversal**: The form engine validates that users can legitimately reach each
step by re-running validations. Submission-only validations are excluded from this process
to avoid blocking users with expensive or time-sensitive checks.

#### `details`
Optional metadata that provides additional context for error handling, particularly useful
for composite fields where you need to specify which sub-component should be highlighted.

Common patterns include:
- `field: string` - Target a specific sub-field in composite components
- `priority: number` - Prioritize certain errors
- Custom data for specialized error processing

## Validation Execution Context

The form engine runs validation in two distinct contexts, each serving different purposes
in ensuring form integrity and user experience.

### Journey Traversal Validation
Occurs when the system verifies that users can legitimately reach each step:

- Checks basic field requirements and format validation
- Ensures users followed the correct path through the form
- Uses only validations where `submissionOnly` is false or undefined
- Prevents expensive operations from blocking navigation

### Submission Validation
Occurs during final form submission:

- Runs ALL validation rules (both regular and submission-only)
- Performs comprehensive checks before data processing
- Includes expensive operations like API calls and uniqueness checks

## Common Patterns

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

### Validation with Additional Details
```typescript
const appointmentDateField = field({
  code: 'appointment_date',
  variant: 'govukDateInput',
  label: 'Preferred appointment date',
  validate: [
    validation({
      when: Self().not.match(Condition.Date.IsValid()),
      message: 'Enter a valid date',
      details: {
        field: 'day'  // Highlight the day field in a multi-field date input
      }
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

### Using the Details Property Effectively
The `details` property should be used to enhance error handling for complex fields:

1. **Field targeting**: Use `field` to specify which sub-component should be highlighted
2. **Error classification**: Use `errorType` to categorize errors for consistent styling
3. **Additional context**: Include any extra data needed for error processing
4. **Keep it simple**: Only include details that will be used by your UI components

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
