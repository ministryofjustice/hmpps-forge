# Conditions

Conditions test values and return true or false. They're used for validation rules, conditional visibility, and branching logic.

## What is a Condition?

A condition is a function that takes a value and returns a boolean. Unlike transformers (which modify values) or generators (which create values), conditions only test values - they never change them.

This enables:
- Validation rules that check user input
- Conditional field visibility (show/hide based on other answers)
- Branching logic in transitions
- Cross-field comparisons

### Import

```typescript
import { Condition } from '@form-engine/registry/conditions'
```

---

## Basic Usage

### Testing Field Values

Use `.match()` to test a value against a condition:

```typescript
// Check if a field has a value
Self().match(Condition.IsRequired())

// Check if value equals something
Answer('country').match(Condition.Equals('UK'))

// Negate with .not
Self().not.match(Condition.IsRequired())  // Field is empty
```

### In Validation Rules

Validation `when` conditions use **negative matching** - show the error when the value is NOT valid:

```typescript
field<GovUKTextInput>({
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

### In Conditional Logic

Use conditions to control field visibility or transitions:

```typescript
// Hide field when condition is NOT met
hidden: Answer('country').not.match(Condition.Equals('UK'))

// Show field when condition IS met (for dependent validation)
dependent: Answer('country').match(Condition.Equals('UK'))

// Conditional navigation
redirect({
  when: Answer('hasDisability').match(Condition.Equals('yes')),
  goto: 'disability-details',
})
```

---

## Combining Conditions

Use `and()`, `or()`, `xor()`, and `not()` to build complex predicates from simple conditions.

### Import Combinators

```typescript
import { and, or, xor, not } from '@form-engine/form/builders'
```

### `and()` - All Must Be True

```typescript
and(
  Self().match(Condition.IsRequired()),
  Self().match(Condition.String.HasMaxLength(100))
)
```

### `or()` - At Least One Must Be True

```typescript
or(
  Answer('contactMethod').match(Condition.Equals('email')),
  Answer('contactMethod').match(Condition.Equals('phone'))
)
```

### `xor()` - Exactly One Must Be True

```typescript
xor(
  Answer('optionA').match(Condition.Equals('yes')),
  Answer('optionB').match(Condition.Equals('yes'))
)
```

### `not()` - Negate a Predicate

```typescript
// Negate a combinator
not(or(
  Answer('tier').match(Condition.Equals('free')),
  Answer('tier').match(Condition.Equals('trial'))
))

// For single conditions, prefer .not on the reference
Self().not.match(Condition.IsRequired())
```

### Nested Combinations

```typescript
and(
  Self().match(Condition.IsRequired()),
  or(
    Self().match(Condition.Email.IsValidEmail()),
    Self().match(Condition.Phone.IsValidPhoneNumber())
  )
)
```

---

## Dynamic Arguments

Condition arguments accept both static values and expressions:

```typescript
// Static: fixed threshold
Condition.Number.GreaterThan(18)

// Dynamic: threshold from another field
Condition.Number.GreaterThan(Answer('minAge'))

// Dynamic: comparison against another field
Condition.Date.IsAfter(Answer('startDate'))

// Dynamic: range from loaded data
Condition.Number.Between(Data('limits.min'), Data('limits.max'))

// Dynamic: allowed values from data
Condition.Array.IsIn(Data('allowedOptions'))
```

This enables:
- **Cross-field validation** - "End date must be after start date"
- **Data-driven rules** - Limits loaded from an API or config
- **User-configurable validation** - Admin sets maximum length

---

## Common Patterns

### Required Field with Format Validation

```typescript
validate: [
  validation({
    when: Self().not.match(Condition.IsRequired()),
    message: 'Enter your email address',
  }),
  validation({
    when: Self().not.match(Condition.Email.IsValidEmail()),
    message: 'Enter a valid email address',
  }),
]
```

### Cross-Field Validation

```typescript
// Confirm email matches email
validation({
  when: Self().not.match(Condition.Equals(Answer('email'))),
  message: 'Email addresses do not match',
})

// End date after start date
validation({
  when: Self().not.match(Condition.Date.IsAfter(Answer('startDate'))),
  message: 'End date must be after the start date',
})
```

### Optional Field with Conditional Format Validation

```typescript
// Only validate format if a value is provided
validation({
  when: and(
    Self().match(Condition.IsRequired()),
    Self().not.match(Condition.Phone.IsValidPhoneNumber())
  ),
  message: 'Enter a valid phone number',
})
```

### Checkbox Group (Multiple Selection)

```typescript
field<GovUKCheckboxInput>({
  code: 'interests',
  multiple: true,
  validate: [
    validation({
      when: Self().not.match(Condition.IsRequired()),
      message: 'Select at least one interest',
    }),
    validation({
      when: Self().not.match(Condition.Array.Contains('terms')),
      message: 'You must accept the terms and conditions',
    }),
  ],
})
```

---

## Custom Conditions

### `defineConditions()` - Without Dependencies

Create conditions that don't need external services:

```typescript
import { defineConditions } from '@form-engine/registry/utils/createRegisterableFunction'
import { assertString, assertNumber } from '@form-engine/registry/utils/asserts'

export const { conditions: MyConditions, registry: MyConditionsRegistry } = defineConditions({
  // Simple condition - no extra parameters
  IsPrisonNumber: value => {
    assertString(value, 'MyConditions.IsPrisonNumber')
    return /^[A-Z][0-9]{4}[A-Z]{2}$/i.test(value.trim())
  },

  // Condition with parameters
  IsValidAge: (value, min: number = 18, max: number = 120) => {
    assertNumber(value, 'MyConditions.IsValidAge')
    assertNumber(min, 'MyConditions.IsValidAge (min)')
    assertNumber(max, 'MyConditions.IsValidAge (max)')
    return Number.isInteger(value) && value >= min && value <= max
  },
})

// Registration
formEngine.registerFunctions(MyConditionsRegistry)

// Usage
validation({
  when: Self().not.match(MyConditions.IsPrisonNumber()),
  message: 'Enter a valid prison number',
})
```

### `defineConditionsWithDeps()` - With Dependencies

Create conditions that need access to external services:

```typescript
import { defineConditionsWithDeps } from '@form-engine/registry/utils/createRegisterableFunction'
import { assertString } from '@form-engine/registry/utils/asserts'

interface MyDeps {
  apiClient: ValidationApiClient
}

export const { conditions: MyConditions, createRegistry: createMyConditionsRegistry } =
  defineConditionsWithDeps<MyDeps>()({
    IsValidPostcode: deps => async (value: string) => {
      assertString(value, 'MyConditions.IsValidPostcode')
      const result = await deps.apiClient.validatePostcode(value)
      return result.isValid
    },

    PrisonerExists: deps => async (prisonNumber: string) => {
      assertString(prisonNumber, 'MyConditions.PrisonerExists')
      const prisoner = await deps.apiClient.lookupPrisoner(prisonNumber)
      return prisoner !== null
    },
  })

// Registration - create registry with real deps at runtime
const registry = createMyConditionsRegistry({
  apiClient: new ValidationApiClient(),
})
formEngine.registerFunctions(registry)
```

### Combining Registries

```typescript
// Without dependencies
export const MyConditionsRegistry = {
  ...PrisonerConditionsRegistry,
  ...AddressConditionsRegistry,
}

// Mixed (some with deps, some without)
export const createMyConditionsRegistry = (deps: ApiDeps) => ({
  ...PrisonerConditionsRegistry,           // No deps
  ...createApiConditionsRegistry(deps),    // Needs deps
})
```

---

## Best Practices

### Use Assertions for Type Safety

Always validate input types to catch configuration errors early:

```typescript
import { assertString, assertNumber } from '@form-engine/registry/utils/asserts'

IsPrisonNumber: value => {
  assertString(value, 'MyConditions.IsPrisonNumber')
  return /^[A-Z][0-9]{4}[A-Z]{2}$/i.test(value)
}
```

### Keep Conditions Pure

Conditions should only test values and return booleans. Side effects belong in effects:

```typescript
// DO: Return boolean
IsPrisonNumber: value => {
  assertString(value, 'IsPrisonNumber')
  return /^[A-Z][0-9]{4}[A-Z]{2}$/i.test(value)
}

// DON'T: Cause side effects
IsPrisonNumber: value => {
  console.log('Checking:', value)     // Side effect
  analytics.track('validation_run')   // Side effect
  return /^[A-Z][0-9]{4}[A-Z]{2}$/i.test(value)
}
```

### Name Descriptively

Use `Is*`, `Has*`, or `*Matches` prefixes so conditions read naturally:

```typescript
Self().match(Condition.IsRequired())
Self().match(Condition.String.HasMinLength(5))
Self().match(Condition.Email.IsValidEmail())
```

---

## Built-in Conditions Registry

### General Conditions

Available at root level: `Condition.IsRequired()`, `Condition.Equals(expected)`

| Condition | Parameters | Description |
|-----------|------------|-------------|
| `IsRequired()` | none | Value is not empty/null/undefined. Returns false for: null, undefined, empty strings (after trim), empty arrays |
| `Equals(expected)` | `expected: any` | Strict equality check (===) |

### String Conditions

Namespace: `Condition.String.*`

| Condition | Parameters | Description |
|-----------|------------|-------------|
| `MatchesRegex(pattern)` | `pattern: string` | Tests against regex pattern |
| `HasMinLength(min)` | `min: number` | String length >= min |
| `HasMaxLength(max)` | `max: number` | String length <= max |
| `HasExactLength(len)` | `len: number` | String length === len |
| `HasMaxWords(maxWords)` | `maxWords: number` | Word count <= maxWords |
| `StartsWith(prefix)` | `prefix: string` | String starts with prefix |
| `EndsWith(suffix)` | `suffix: string` | String ends with suffix |
| `Contains(substring)` | `substring: string` | String contains substring |
| `LettersOnly()` | none | Only A-Z, a-z |
| `DigitsOnly()` | none | Only 0-9 |
| `LettersAndDigitsOnly()` | none | Alphanumeric only |
| `LettersWithSpaceDashApostrophe()` | none | Letters + space, dash, apostrophe (for names) |
| `LettersWithCommonPunctuation()` | none | Letters + `. , ' " ( ) - ! ?` and space |
| `AlphanumericWithCommonPunctuation()` | none | Alphanumeric + `. , ' " ( ) - ! ?` and space |
| `AlphanumericWithAllSafeSymbols()` | none | Alphanumeric + space + `. , ; : ' " ( ) - ! ? @ # $ % ^ & *` |

### Number Conditions

Namespace: `Condition.Number.*`

| Condition | Parameters | Description |
|-----------|------------|-------------|
| `IsNumber()` | none | Value is a valid number (not NaN, not string) |
| `IsInteger()` | none | Value is a whole number |
| `GreaterThan(threshold)` | `threshold: number` | value > threshold |
| `GreaterThanOrEqual(threshold)` | `threshold: number` | value >= threshold |
| `LessThan(threshold)` | `threshold: number` | value < threshold |
| `LessThanOrEqual(threshold)` | `threshold: number` | value <= threshold |
| `Between(min, max)` | `min: number, max: number` | min <= value <= max (inclusive) |

### Date Conditions

Namespace: `Condition.Date.*`

All date conditions expect ISO-8601 format: `YYYY-MM-DD`

| Condition | Parameters | Description |
|-----------|------------|-------------|
| `IsValid()` | none | Valid ISO date that exists (e.g., no Feb 30) |
| `IsValidYear()` | none | Year component is 1000-9999 |
| `IsValidMonth()` | none | Month component is 1-12 |
| `IsValidDay()` | none | Day is valid for the specific month/year (handles leap years) |
| `IsBefore(dateStr)` | `dateStr: string` | Date is before comparison date |
| `IsAfter(dateStr)` | `dateStr: string` | Date is after comparison date |
| `IsFutureDate()` | none | Date is after today (UTC) |

### Array Conditions

Namespace: `Condition.Array.*`

| Condition | Parameters | Description |
|-----------|------------|-------------|
| `IsIn(expected)` | `expected: any[]` | Value exists in the expected array |
| `Contains(expected)` | `expected: any` | Array contains the expected value |
| `ContainsAny(expected)` | `expected: any[]` | Array contains at least one item from expected |
| `ContainsAll(expected)` | `expected: any[]` | All items in value exist in expected array |

### Email Conditions

Namespace: `Condition.Email.*`

| Condition | Parameters | Description |
|-----------|------------|-------------|
| `IsValidEmail()` | none | Valid email format with proper domain structure |

### Phone Conditions

Namespace: `Condition.Phone.*`

| Condition | Parameters | Description |
|-----------|------------|-------------|
| `IsValidPhoneNumber()` | none | Valid phone format (7-20 digits, optional +, separators allowed) |
| `IsValidUKMobile()` | none | UK mobile format: 07xxx xxxxxx, +447xxx xxxxxx |

### Address Conditions

Namespace: `Condition.Address.*`

| Condition | Parameters | Description |
|-----------|------------|-------------|
| `IsValidPostcode()` | none | Valid UK postcode format |

### Object Conditions

Namespace: `Condition.Object.*`

| Condition | Parameters | Description |
|-----------|------------|-------------|
| `IsObject()` | none | Value is a plain object (not null, not array) |
| `HasProperty(path)` | `path: string` | Object has property at path (supports dot notation) |
| `PropertyIsEmpty(path)` | `path: string` | Property at path is empty/missing |
| `PropertyHasValue(path)` | `path: string` | Property at path has a non-empty value |
