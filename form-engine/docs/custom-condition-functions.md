# Creating Custom Condition Functions

## Overview
The form system allows you to create custom condition functions that extend the built-in
validation and logic capabilities. Custom functions integrate seamlessly with the existing
predicate/transitions system, as long as they are registered within the form engine.

## Creating Custom Conditions

### Basic Structure
Custom conditions are created using the `defineFunction` helper, which ensures
proper typing and integration with the form engine:

```typescript
import { defineFunction } from '@form-system/helpers'

const MyCustomConditions = {
  isEvenNumber: defineFunction(
    'isEvenNumber',
    (value) => typeof value === 'number' && value % 2 === 0
  )
}

Answer('some_answer').match(MyCustomConditions.isEvenNumber())
```

### Function Signature
The `defineFunction` helper takes two parameters:

1. **name** (`string`): The unique identifier for your condition. Use camelCase for consistency.
2. **evaluator** (`(value, ...args) => boolean | Promise<boolean>`): The function that performs the actual validation

```typescript
defineFunction<A extends readonly ValueExpr[]>(
  name: string,
  evaluator: (value: ValueExpr, ...args: A) => boolean | Promise<boolean>
)
```

### Parameters and Type Safety
Custom conditions can accept additional parameters with full TypeScript support:

```typescript
// Single parameter with type
const hasMinValue = defineFunction(
  'hasMinValue',
  (value, min: number) => typeof value === 'number' && value >= min
)

// Multiple parameters with types
const isBetween = defineFunction(
  'isBetween',
  (value, min: number, max: number) =>
    typeof value === 'number' && value >= min && value <= max
)

// Complex parameter types
const matchesPattern = defineFunction(
  'matchesPattern',
  (value, pattern: RegExp, flags?: string) => {
    const regex = flags ? new RegExp(pattern, flags) : pattern
    return typeof value === 'string' && regex.test(value)
  }
)
```

When you specify parameter types in your evaluator function, TypeScript will enforce these
types when the condition is used in your form configuration:

```typescript
// TypeScript will enforce correct types
validate: [
  when(Self().match(hasMinValue(10))),        // ✓ Correct
  when(Self().match(hasMinValue('10')))      // ✗ Type error
]
```

## Examples
Here are a bunch of examples to inspire you to build your own conditions.

```typescript
const isSlug = defineFunction(
  'isSlug',
  (value) =>
    typeof value === 'string' &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
)

const isInRange = defineFunction(
  'isInRange',
  (value, ranges: Array<[number, number]>) => {
    if (typeof value !== 'number') return false
    return ranges.some(([min, max]) => value >= min && value <= max)
  }
)

const hasUniqueValues = defineFunction(
  'hasUniqueValues',
  (value) => {
    if (!Array.isArray(value)) return false
    return new Set(value).size === value.length
  }
)

const isStrongPassword = defineFunction(
  'isStrongPassword',
  (value, requirements?: {
    minLength?: number
    requireUppercase?: boolean
    requireLowercase?: boolean
    requireNumbers?: boolean
    requireSpecialChars?: boolean
  }) => {
    if (typeof value !== 'string') return false

    const reqs = requirements || {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true
    }

    if (value.length < (reqs.minLength || 8)) return false
    if (reqs.requireUppercase && !/[A-Z]/.test(value)) return false
    if (reqs.requireLowercase && !/[a-z]/.test(value)) return false
    if (reqs.requireNumbers && !/[0-9]/.test(value)) return false
    if (reqs.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(value)) return false

    return true
  }
)
```

### Async Conditions
For conditions that need to perform asynchronous operations:

> [!IMPORTANT]
> If you do use an external data source for validation/conditional logic, expect that the data may change and then
> cause a user to be reverted to an earlier step in the journey if it was used for validation (due to journey path
> transversal checking). I would recommend against doing this.

>[!WARNING]
> There's probably some kind of solution to the above warning where a function/validation operation can be marked
> as non-pure so it's skipped for validation checking when doing journey path transversal checks. That would
> allow for a nice mixture of at-submission validation, like the below example for unique usernames, as this would
> cause a failure in subsequent validation check (as the username would now have been registered).

```typescript
const isUniqueUsername = defineFunction(
  'isUniqueUsername',
  async (value) => {
    if (typeof value !== 'string' || value.length < 3) return false

    // Example API call
    return await accountService.isUsernameUnique(value)
  }
)
```

## Registration
> [!WARNING]
> **TODO**: The registration process will be implemented when configuring the form library.
> Users will provide an array of custom functions during initialization.

## Error Handling
Your custom conditions should handle errors appropriately:
> [!WARNING]
> I probably want to add custom Error types for this, so the form engine can catch them and handle
> them more neatly

```typescript
const requiresApiCheck = defineFunction(
  'requiresApiCheck',
  async (value) => {
    try {
      const result = await someApiCall(value)
      return result.valid
    } catch (error) {
      // For unexpected errors, throw to let the form engine handle it
      throw new ValidationError(`API validation failed: ${error.message}`)
    }
  }
)
```

## Best Practices

### 1. Naming Conventions
Use descriptive camelCase names that clearly indicate what the condition checks:

```typescript
// Good
isValidPostcode
hasMinimumAge
matchesAccountFormat

// Avoid
validate1
checkThis
postcodeCheck
```

### 2. Type Guards
Always validate the input type before processing:

```typescript
const isPercentage = defineFunction(
  'isPercentage',
  (value) => {
    // Always check type first
    if (typeof value !== 'number') return false
    return value >= 0 && value <= 100
  }
)
```

### 3. Parameter Validation
Validate parameters to prevent runtime errors:

```typescript
const hasPattern = defineFunction(
  'hasPattern',
  (value, pattern: string, flags?: string) => {
    if (typeof value !== 'string') return false
    if (typeof pattern !== 'string') return false

    try {
      const regex = new RegExp(pattern, flags)
      return regex.test(value)
    } catch {
      // Invalid regex pattern
      return false
    }
  }
)
```

### 4. Single Responsibility
Keep conditions focused on a single validation concern:

```typescript
// Good - single responsibility
const isUKPostcode = defineFunction(/* ... */)
const isRequiredField = defineFunction(/* ... */)

// Avoid - multiple responsibilities
const isValidAndRequiredUKPostcode = defineFunction(/* ... */)
```

### 5. Reusability
Design conditions to be reusable across different contexts:

```typescript
// Reusable with parameters
const matchesLength = defineFunction(
  'matchesLength',
  (value, min: number, max?: number) => {
    if (typeof value !== 'string') return false
    const len = value.length
    return max ? len >= min && len <= max : len >= min
  }
)

// Can be used in multiple ways
validate: [
  when(Self().not.match(matchesLength(5))).then('Minimum 5 characters'),
  when(Self().not.match(matchesLength(5, 20))).then('Between 5-20 characters')
]
```

## JSON Output

When custom functions are used in form configuration, they compile to the standard function format:

```typescript
// Usage in configuration
validate: [
  when(Self().match(isStrongPassword({ minLength: 12 })))
    .then('Valid password')
]

// Compiles to JSON
{
  type: 'conditional',
  predicate: {
    type: 'test',
    subject: { type: 'reference', path: ['@self'] },
    negate: false,
    condition: {
      type: 'function',
      name: 'isStrongPassword',
      arguments: [{ minLength: 12 }]
    }
  },
  thenValue: 'Valid password',
  elseValue: false
}
```

The form engine will look up the `isStrongPassword` function by name in the registry and
execute its evaluator with the provided arguments during validation.
