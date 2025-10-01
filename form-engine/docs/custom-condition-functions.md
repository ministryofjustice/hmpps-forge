# Creating Custom Condition Functions

## Overview
The form system allows you to create custom condition functions that extend the built-in
validation and logic capabilities. Custom functions integrate seamlessly with the existing
predicate/transitions system, as long as they are registered within the form engine.

## Creating Custom Conditions

### Basic Structure
Custom conditions are created using the `defineConditions` helper, which ensures
proper typing and integration with the form engine:

```typescript
import { defineConditions } from '@form-engine/registry/utils/createRegisterableFunction'

const { conditions: MyCustomConditions, registry: MyCustomConditionsRegistry } = defineConditions({
  IsEvenNumber: (value) => typeof value === 'number' && value % 2 === 0,
  IsOddNumber: (value) => typeof value === 'number' && value % 2 !== 0
})

// Usage in form definition
Answer('some_answer').match(MyCustomConditions.IsEvenNumber())
```

### Function Signature
The `defineConditions` helper takes an object where:

- **Keys** are the condition names (use PascalCase for consistency)
- **Values** are evaluator functions `(value, ...args) => boolean | Promise<boolean>`

It returns an object with:
- **conditions**: Builder functions for creating condition expressions
- **registry**: Registry object for registration with FormEngine

### Parameters and Type Safety
Custom conditions can accept additional parameters with full TypeScript support:

```typescript
const { conditions, registry } = defineConditions({
  // Single parameter with type
  HasMinValue: (value, min: number) =>
    typeof value === 'number' && value >= min,

  // Multiple parameters with types
  IsBetween: (value, min: number, max: number) =>
    typeof value === 'number' && value >= min && value <= max,

  // Complex parameter types
  MatchesPattern: (value, pattern: string, flags?: string) => {
    try {
      const regex = new RegExp(pattern, flags)
      return typeof value === 'string' && regex.test(value)
    } catch {
      return false
    }
  }
})
```

When you specify parameter types in your evaluator function, TypeScript will enforce these
types when the condition is used in your form configuration:

```typescript
// TypeScript will enforce correct types
validate: [
  // BAD - Will have a type error
  validation({
    when: Self().match(conditions.HasMinValue('10')),
    message: 'Invalid type'
  }),

  // GOOD - Uses correct type for condition arguments.
  validation({
    when: Self().match(conditions.HasMinValue(10)),
    message: 'Value must be at least 10'
  }),
]
```

## Examples
Here are a bunch of examples to inspire you to build your own conditions.

```typescript
const { conditions, registry } = defineConditions({
  IsSlug: (value) =>
    typeof value === 'string' &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),

  IsInRange: (value, ranges: Array<[number, number]>) => {
    if (typeof value !== 'number') return false
    return ranges.some(([min, max]) => value >= min && value <= max)
  },

  HasUniqueValues: (value) => {
    if (!Array.isArray(value)) return false
    return new Set(value).size === value.length
  },

  IsStrongPassword: (value, requirements?: {
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
})
```

### Async Conditions
For conditions that need to perform asynchronous operations:

> [!IMPORTANT]
> If you do use an external data source for validation/conditional logic, expect that the data may change.
> Use `submissionOnly` for these validations to not trap the user to an earlier step in the form when they
> next access previously submitted form data.

```typescript
const { conditions, registry } = defineConditions({
  IsUniqueUsername: async (value) => {
    if (typeof value !== 'string' || value.length < 3) return false

    // Example API call
    return await accountService.isUsernameUnique(value)
  }
})
```

### Conditions with Dependencies
For conditions that need external dependencies, use `defineConditionsWithDeps`:

```typescript
import { defineConditionsWithDeps } from '@form-engine/registry/utils/createRegisterableFunction'

const deps = {
  apiClient: new ApiClient(),
  config: { minAge: 18, maxRetries: 3 }
}

const { conditions, registry } = defineConditionsWithDeps(deps, {
  IsValidUser: (deps) => async (userId: string) => {
    try {
      const user = await deps.apiClient.getUser(userId)
      return user.active && user.verified
    } catch {
      return false
    }
  },

  MeetsAgeRequirement: (deps) => (age: number) => {
    return age >= deps.config.minAge
  }
})
```

## Registration

Conditions must be registered with the FormEngine to be available for use in forms.
Registration typically happens during application initialization:

```typescript
import FormEngine from '@form-engine/core/FormEngine'
import { defineConditions } from '@form-engine/registry/utils/createRegisterableFunction'

// Define your custom conditions
const { conditions: CustomConditions, registry: CustomConditionsRegistry } = defineConditions({
  IsStrongPassword: (value, minLength?: number) => {
    // implementation
  },
  HasSpecialCharacters: (value) => {
    // implementation
  },
  MatchesPattern: (value, pattern: string) => {
    // implementation
  }
})

// Create the form engine instance
const formEngine = new FormEngine()

// Register the conditions using the registry
formEngine.registerFunctions(CustomConditionsRegistry)

// Export conditions for use in form definitions
export { CustomConditions }
```

### Registration Notes
- Built-in conditions (like `isRequired`, `hasMinLength`) are registered automatically unless disabled via options
- Functions are stored by their `name` property in the FunctionRegistry
- Attempting to register a duplicate name will throw a `RegistryDuplicateError`
- Invalid function specs will throw a `RegistryValidationError`

## Error Handling
Your custom conditions should handle errors appropriately:
> [!WARNING]
> I probably want to add custom Error types for this, so the form engine can catch them and handle
> them more neatly

```typescript
const { conditions, registry } = defineConditions({
  RequiresApiCheck: async (value) => {
    try {
      const result = await someApiCall(value)
      return result.valid
    } catch (error) {
      // For unexpected errors, throw to let the form engine handle it
      throw new ValidationError(`API validation failed: ${error.message}`)
    }
  }
})
```

## Best Practices

### 1. Naming Conventions
Use descriptive PascalCase names that clearly indicate what the condition checks:

```typescript
// Good
IsValidPostcode
HasMinimumAge
MatchesAccountFormat

// Avoid
validate1
checkThis
postcodeCheck
```

### 2. Type Guards
Always validate the input type before processing:

```typescript
const { conditions, registry } = defineConditions({
  IsPercentage: (value) => {
    // Always check type first
    if (typeof value !== 'number') return false
    return value >= 0 && value <= 100
  }
})
```

### 3. Parameter Validation
Validate parameters to prevent runtime errors:

```typescript
const { conditions, registry } = defineConditions({
  HasPattern: (value, pattern: string, flags?: string) => {
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
})
```

### 4. Single Responsibility
Keep conditions focused on a single validation concern:

```typescript
// Good - single responsibility
const { conditions, registry } = defineConditions({
  IsUKPostcode: (value) => { /* ... */ },
  IsRequiredField: (value) => { /* ... */ }
})

// Avoid - multiple responsibilities
const { conditions: BadConditions } = defineConditions({
  IsValidAndRequiredUKPostcode: (value) => { /* ... */ }
})
```

### 5. Reusability
Design conditions to be reusable across different contexts:

```typescript
const { conditions, registry } = defineConditions({
  // Reusable with parameters
  MatchesLength: (value, min: number, max?: number) => {
    if (typeof value !== 'string') return false
    const len = value.length
    return max ? len >= min && len <= max : len >= min
  }
})

// Can be used in multiple ways
validate: [
  validation({
    when: Self().not.match(conditions.MatchesLength(5)),
    message: 'Minimum 5 characters'
  }),
  validation({
    when: Self().not.match(conditions.MatchesLength(5, 20)),
    message: 'Between 5-20 characters'
  })
]
```

## JSON Output

When custom functions are used in form configuration, they compile to the standard function format:

```typescript
// Usage in configuration
validate: [
  validation({
    when: Self().match(conditions.IsStrongPassword(12)),
    message: 'Valid password'
  })
]

// Compiles to JSON
{
  type: 'validation',
  when: {
    type: 'LogicType.Test',
    subject: { type: 'ExpressionType.Reference', path: ['@self'] },
    negate: false,
    condition: {
      type: 'FunctionType.Condition',
      name: 'IsStrongPassword',
      arguments: [12]
    }
  },
  message: 'Valid password'
}
```

The form engine will look up the `IsStrongPassword` function by name in the registry and
execute its evaluator with the provided arguments during validation.
