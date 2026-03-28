# Generators

Some values can't be hardcoded - a date picker's minimum date should be "today", not a fixed string. Generators produce values on demand at runtime.

## What is a Generator?

A generator is a function that produces a value from nothing (or from its arguments). Unlike conditions (which test existing values) or transformers (which modify existing values), generators create new values at runtime.

This enables:
- Dynamic defaults that change over time (e.g., today's date)
- Computed constraints for date pickers and validators
- Value pipelines that generate then transform values
- Unique identifiers and timestamps

### Import

```typescript
import { Generator } from '@form-engine/registry/generators'
```

---

## Basic Usage

### Dynamic Default Values

Set a field's default to a generated value:

```typescript
import { Generator } from '@form-engine/registry/generators'

field<MOJDatePicker>({
  variant: 'mojDatePicker',
  code: 'appointmentDate',
  label: { text: 'Select appointment date' },
  minDate: Generator.Date.Now(),  // Can't select dates in the past
})
```

### Date Constraints

Use generators to set dynamic min/max dates:

```typescript
field<MOJDatePicker>({
  variant: 'mojDatePicker',
  code: 'startDate',
  label: { text: 'Start date' },
  minDate: Generator.Date.Today(),  // Today or later
})
```

---

## The Chaining API

Generators return chainable objects that support the same fluent API as references:

| Method | Purpose | Returns |
|--------|---------|---------|
| `.pipe(...transformers)` | Transform generated value | Chainable expression |
| `.match(condition)` | Test generated value | Boolean expression |
| `.not` | Negate next `.match()` | Same type (negated) |

### `.pipe()` - Transform Generated Values

Chain generators with transformers to create computed values:

```typescript
import { Generator } from '@form-engine/registry/generators'
import { Transformer } from '@form-engine/registry/transformers'

// Generate today, add 7 days
const nextWeek = Generator.Date.Now().pipe(
  Transformer.Date.AddDays(7)
)

// Generate today, format as ISO string
const todayISO = Generator.Date.Today().pipe(
  Transformer.Date.ToISOString()
)

// Multiple transformers
const deadline = Generator.Date.Now().pipe(
  Transformer.Date.AddDays(30),
  Transformer.Date.ToISOString()
)
```

### `.match()` - Test Generated Values

Test a generated value against a condition:

```typescript
// Check if generated date is in the future (always false for Now())
Generator.Date.Now().match(Condition.Date.IsFutureDate())

// With negation
Generator.Date.Now().not.match(Condition.Date.IsFutureDate())
```

---

## Common Patterns

### Appointment Booking (Future Dates Only)

```typescript
field<MOJDatePicker>({
  variant: 'mojDatePicker',
  code: 'appointmentDate',
  label: { text: 'Select appointment date' },
  hint: { text: 'Choose a date in the future' },
  minDate: Generator.Date.Today(),
  validate: [
    validation({
      when: Self().not.match(Condition.IsRequired()),
      message: 'Select an appointment date',
    }),
  ],
})
```

### Date Range with Computed Maximum

```typescript
// Start date: today onwards
field<MOJDatePicker>({
  variant: 'mojDatePicker',
  code: 'startDate',
  label: { text: 'Start date' },
  minDate: Generator.Date.Today(),
})

// End date: within 30 days of today
field<MOJDatePicker>({
  variant: 'mojDatePicker',
  code: 'endDate',
  label: { text: 'End date' },
  minDate: Generator.Date.Today(),
  maxDate: Generator.Date.Today().pipe(Transformer.Date.AddDays(30)),
})
```

### Pre-populated Timestamp

```typescript
field<GovUKTextInput>({
  variant: 'govukTextInput',
  code: 'submittedAt',
  label: 'Submitted at',
  defaultValue: Generator.Date.Now().pipe(
    Transformer.Date.ToISOString()
  ),
  // Hidden from user, captured automatically
  hidden: true,
})
```

---

## Custom Generators

### `defineGenerators()` - Without Dependencies

Create generators that don't need external services:

```typescript
import { defineGenerators } from '@form-engine/registry/utils/createRegisterableFunction'

export const { generators: MyGenerators, registry: MyGeneratorsRegistry } = defineGenerators({
  // Simple generator: no arguments
  UUID: () => crypto.randomUUID(),

  // Generator with arguments
  PrefixedUUID: (prefix: string) => `${prefix}${crypto.randomUUID()}`,

  // Date generator
  Tomorrow: () => {
    const date = new Date()
    date.setDate(date.getDate() + 1)
    return date
  },
})

// Registration
formEngine.registerFunctions(MyGeneratorsRegistry)

// Usage in forms
defaultValue: MyGenerators.UUID()
defaultValue: MyGenerators.PrefixedUUID('order-')
```

### `defineGeneratorsWithDeps()` - With Dependencies

Create generators that need access to external services:

```typescript
import { defineGeneratorsWithDeps } from '@form-engine/registry/utils/createRegisterableFunction'

interface MyDeps {
  userService: UserService
  timeApi: TimeApiClient
}

// Define generators - builders available immediately without deps
export const { generators: MyGenerators, createRegistry: createMyGeneratorsRegistry } =
  defineGeneratorsWithDeps<MyDeps>()({
    // Sync generator with deps
    CurrentUserId: deps => () => deps.userService.getCurrentUserId(),

    // Async generator with deps
    ServerTime: deps => async () => {
      const response = await deps.timeApi.getServerTime()
      return new Date(response.timestamp)
    },

    // Generator with args and deps
    UserEmail: deps => (userId: string) => deps.userService.getEmail(userId),
  })

// Registration - create registry with real deps at runtime
const registry = createMyGeneratorsRegistry({
  userService: new UserService(),
  timeApi: new TimeApiClient(),
})
formEngine.registerFunctions(registry)

// Usage in forms (no deps needed at definition time)
defaultValue: MyGenerators.CurrentUserId()
defaultValue: MyGenerators.ServerTime()
```

### Combining Registries

Merge multiple generator registries:

```typescript
// Without dependencies
export const MyGeneratorsRegistry = {
  ...DateGeneratorsRegistry,
  ...IdentifierGeneratorsRegistry,
}

// Mixed (some with deps, some without)
export const createMyGeneratorsRegistry = (deps: ApiDeps) => ({
  ...DateGeneratorsRegistry,              // No deps
  ...createApiGeneratorsRegistry(deps),   // Needs deps
})
```

---

## Best Practices

### Combine with Transformers Instead of Creating New Generators

Before creating a new generator, check if you can achieve the result by piping an existing generator through transformers:

```typescript
// DO: Use pipe to modify existing generator output
maxDate: Generator.Date.Today().pipe(Transformer.Date.AddDays(30))
defaultId: Generator.UUID().pipe(Transformer.String.ToUpperCase())

// DON'T: Create separate generators for every variation
maxDate: Generator.Date.ThirtyDaysFromNow()  // Unnecessary proliferation
defaultId: Generator.UppercaseUUID()         // Just pipe the existing one
```

### Use Generators for Dynamic Values Only

If a value is truly static, don't use a generator:

```typescript
// DO: Use generator for dynamic values
minDate: Generator.Date.Today()  // Changes each day

// DON'T: Use generator for static values
minDate: Generator.Date.FixedDate('2024-01-01')  // Just use a string
```

### Keep Generators Pure

Generators should produce values, not cause side effects:

```typescript
// DO: Return a value
UUID: () => crypto.randomUUID()

// DON'T: Cause side effects in generators
UUID: () => {
  console.log('Generating UUID')  // Side effect
  db.logGeneration()              // Side effect
  return crypto.randomUUID()
}
```

Use effects for side effects instead.

---

## Built-in Generators Registry

### Date Generators

Namespace: `Generator.Date.*`

| Generator | Parameters | Returns | Description |
|-----------|------------|---------|-------------|
| `Now()` | none | `Date` | Current date and time with full timestamp |
| `Today()` | none | `Date` | Today's date at midnight (00:00:00.000) |

#### `Generator.Date.Now()`

Returns the current date and time as a `Date` object with the full timestamp.

```typescript
Generator.Date.Now()
// → Date object: 2024-03-15T14:30:45.123Z
```

**Use cases:**
- Timestamps for submissions
- "Last updated" fields
- Time-sensitive constraints

#### `Generator.Date.Today()`

Returns today's date at midnight (start of day). Useful when you need a date without the time component.

```typescript
Generator.Date.Today()
// → Date object: 2024-03-15T00:00:00.000Z
```

**Use cases:**
- Date comparisons (ignoring time)
- Default values for date fields
- Date range boundaries
