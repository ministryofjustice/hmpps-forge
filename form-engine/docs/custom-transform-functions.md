# Creating Custom Transformer Functions

## Overview
The form system allows you to create custom transformer functions that modify and shape data
throughout your forms. Custom transformers integrate seamlessly with the existing pipeline
system and can be used to format values, extract data, or perform complex data manipulations.

## Creating Custom Transformers

### Basic Structure
Custom transformers are created using the `buildTransformerFunction` helper, which ensures
proper typing and integration with the form engine:

```typescript
import { buildTransformerFunction } from '@form-system/helpers'

const MyCustomTransformers = {
  toUpperCase: buildTransformerFunction(
    'toUpperCase',
    (value) => typeof value === 'string' ? value.toUpperCase() : value
  )
}

// Usage in a pipeline
Answer('some_answer').pipe(MyCustomTransformers.toUpperCase())
```

### Function Signature
The `buildTransformerFunction` helper takes two parameters:

1. **name** (`string`): The unique identifier for your transformer. Use camelCase for consistency.
2. **transformer** (`(value, ...args) => any | Promise<any>`): The function that performs the transformation

```typescript
buildTransformerFunction<A extends readonly ValueExpr[]>(
  name: string,
  transformer: (value: ValueExpr, ...args: A) => any | Promise<any>
)
```

### Parameters and Type Safety
Custom transformers can accept additional parameters with full TypeScript support:

```typescript
// Single parameter transformer
const multiply = buildTransformerFunction(
  'multiply',
  (value, factor: number) => typeof value === 'number' ? value * factor : value
)

// Multiple parameters
const clamp = buildTransformerFunction(
  'clamp',
  (value, min: number, max: number) => {
    if (typeof value !== 'number') return value
    return Math.min(Math.max(value, min), max)
  }
)

// Complex parameter types
const formatDate = buildTransformerFunction(
  'formatDate',
  (value, format: string, locale?: string) => {
    if (!value) return value
    const date = new Date(value)
    if (isNaN(date.getTime())) return value

    // Simple formatting example
    if (format === 'ISO') return date.toISOString()
    if (format === 'DATE') return date.toLocaleDateString(locale)
    if (format === 'TIME') return date.toLocaleTimeString(locale)
    return date.toLocaleString(locale)
  }
)
```

TypeScript will enforce these types when the transformer is used:

```typescript
// TypeScript will enforce correct types
value: Answer('price').pipe(multiply(1.2))         // ✓ Correct
value: Answer('price').pipe(multiply('1.2'))       // ✗ Type error
```

## Examples
Here are various examples to inspire you to build your own transformers.

```typescript
const trim = buildTransformerFunction(
  'trim',
  (value) => typeof value === 'string' ? value.trim() : value
)

const truncate = buildTransformerFunction(
  'truncate',
  (value, maxLength: number, suffix: string = '...') => {
    if (typeof value !== 'string') return value
    if (value.length <= maxLength) return value
    return value.substring(0, maxLength - suffix.length) + suffix
  }
)

const slugify = buildTransformerFunction(
  'slugify',
  (value) => {
    if (typeof value !== 'string') return value
    return value
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }
)

const capitalize = buildTransformerFunction(
  'capitalize',
  (value) => {
    if (typeof value !== 'string') return value
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
  }
)

const sortBy = buildTransformerFunction(
  'sortBy',
  (value, property?: string, order: 'asc' | 'desc' = 'asc') => {
    if (!Array.isArray(value)) return value

    const sorted = [...value].sort((a, b) => {
      const aVal = property ? a[property] : a
      const bVal = property ? b[property] : b

      if (aVal < bVal) return order === 'asc' ? -1 : 1
      if (aVal > bVal) return order === 'asc' ? 1 : -1
      return 0
    })

    return sorted
  }
)

const maskSensitive = buildTransformerFunction(
  'maskSensitive',
  (value, showLast: number = 4, maskChar: string = '*') => {
    if (typeof value !== 'string' || value.length <= showLast) return value
    const masked = maskChar.repeat(value.length - showLast)
    return masked + value.slice(-showLast)
  }
)

const calculateAge = buildTransformerFunction(
  'calculateAge',
  (value, referenceDate?: string) => {
    if (!value) return null
    const birthDate = new Date(value)
    if (isNaN(birthDate.getTime())) return null

    const reference = referenceDate ? new Date(referenceDate) : new Date()
    let age = reference.getFullYear() - birthDate.getFullYear()
    const monthDiff = reference.getMonth() - birthDate.getMonth()

    if (monthDiff < 0 || (monthDiff === 0 && reference.getDate() < birthDate.getDate())) {
      age--
    }

    return age
  }
)
```

### Async Transformers
For transformers that need to perform asynchronous operations:

> [!IMPORTANT]
> Async transformers should be used sparingly as they can impact form performance.
> Consider whether the transformation can be done at the data source level instead.

```typescript
// THINK OF SOME EXAMPLES
```

## Using Transformers in Pipelines
Transformers are commonly used in pipeline expressions to chain multiple transformations:

```typescript
// Single transformation
value: Answer('phone').pipe(extractNumbers())

// Chained transformations
value: Answer('email').pipe(
  trim(),
  toLowerCase(),
  maskSensitive(4, '*')
)

```

## Registration
> [!WARNING]
> **TODO**: The registration process will be implemented when configuring the form library.
> Users will provide an array of custom functions during initialization.

## Error Handling
Transformers should handle errors gracefully and return sensible defaults:
> [!WARNING]
> I probably want to add custom Error types for this, so the form engine can catch them and handle
> them more neatly

```typescript
// SOME EXAMPLES ALSO
```

## Best Practices

### 1. Naming Conventions
Use descriptive camelCase names that clearly indicate the transformation:

```typescript
// Good
toUpperCase
formatCurrency
extractPostcode
calculateTotal

// Avoid
transform1
processData
doStuff
```

### 2. Immutability
Never modify the input value directly; always return a new value:

```typescript
// Bad - mutates input (input will likely be READONLY somehow, proxy?)
const badAddProperty = buildTransformerFunction(
  'addProperty',
  (value, key: string, val: any) => {
    value[key] = val  // Mutates original!
    return value
  }
)

// Good - returns new object
const addProperty = buildTransformerFunction(
  'addProperty',
  (value, key: string, val: any) => {
    if (typeof value !== 'object' || value === null) return value
    return { ...value, [key]: val }  // New object
  }
)
```

### 3. Type Safety
Always check input types and handle unexpected inputs gracefully:

```typescript
const appendString = buildTransformerFunction(
  'appendString',
  (value, suffix: string) => {
    // Handle non-string inputs gracefully
    if (typeof value !== 'string') return value
    return value + suffix
  }
)
```

### 4. Composability
Design transformers to work well in pipelines:

```typescript
// Small, focused transformers that compose well
const trim = buildTransformerFunction('trim', v => typeof v === 'string' ? v.trim() : v)
const toLowerCase = buildTransformerFunction('toLowerCase', v => typeof v === 'string' ? v.toLowerCase() : v)
const removeSpaces = buildTransformerFunction('removeSpaces', v => typeof v === 'string' ? v.replace(/\s/g, '') : v)

// Can be combined in various ways
value: Answer('code').pipe(
  trim(),
  toLowerCase(),
  removeSpaces()
)
```

## JSON Output

When custom transformers are used in form configuration, they compile to the standard function format:

```typescript
// Usage in configuration
value: Answer('price').pipe(
  multiply(1.2),
  currency('GBP')
)

// Compiles to JSON
{
  type: 'ExpressionType.Pipeline',
  input: { type: 'ExpressionType.Reference', path: ['answers', 'price'] },
  steps: [
    {
      type: 'FunctionType.Transformer',
      name: 'multiply',
      arguments: [1.2]
    },
    {
      type: 'FunctionType.Transformer',
      name: 'currency',
      arguments: ['GBP']
    }
  ]
}
```

The form engine will look up each transformer function by name in the registry and
execute them in sequence, passing the output of each as input to the next.
