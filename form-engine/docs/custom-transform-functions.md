# Creating Custom Transformer Functions

## Overview
The form system allows you to create custom transformer functions that modify and shape data
throughout your forms. Custom transformers integrate seamlessly with the existing pipeline
system and can be used to format values, extract data, or perform complex data manipulations.

## Creating Custom Transformers

### Basic Structure
Custom transformers are created using the `defineTransformers` helper, which ensures
proper typing and integration with the form engine:

```typescript
import { defineTransformers } from '@form-engine/registry/utils/createRegisterableFunction'

const { transformers: MyCustomTransformers, registry: MyCustomTransformersRegistry } = defineTransformers({
  ToUpperCase: (value) => typeof value === 'string' ? value.toUpperCase() : value,
  ToLowerCase: (value) => typeof value === 'string' ? value.toLowerCase() : value,
  Trim: (value) => typeof value === 'string' ? value.trim() : value
})

// Usage in a pipeline
Answer('some_answer').pipe(MyCustomTransformers.ToUpperCase())
```

### Function Signature
The `defineTransformers` helper takes an object where:

- **Keys** are the transformer names (use PascalCase for consistency)
- **Values** are transformer functions `(value, ...args) => ValueExpr | Promise<ValueExpr>`

It returns an object with:
- **transformers**: Builder functions for creating transformer expressions
- **registry**: Registry object for registration with FormEngine

### Parameters and Type Safety
Custom transformers can accept additional parameters with full TypeScript support:

```typescript
const { transformers, registry } = defineTransformers({
  // Single parameter transformer
  Multiply: (value, factor: number) =>
    typeof value === 'number' ? value * factor : value,

  // Multiple parameters
  Clamp: (value, min: number, max: number) => {
    if (typeof value !== 'number') return value
    return Math.min(Math.max(value, min), max)
  },

  // Complex parameter types
  FormatDate: (value, format: string, locale?: string) => {
    if (!value) return value
    const date = new Date(value)
    if (isNaN(date.getTime())) return value

    // Simple formatting example
    if (format === 'ISO') return date.toISOString()
    if (format === 'DATE') return date.toLocaleDateString(locale)
    if (format === 'TIME') return date.toLocaleTimeString(locale)
    return date.toLocaleString(locale)
  }
})
```

TypeScript will enforce these types when the transformer is used:

```typescript
// TypeScript will enforce correct types
value: Answer('price').pipe(transformers.Multiply(1.2))         // ✓ Correct
value: Answer('price').pipe(transformers.Multiply('1.2'))       // ✗ Type error
```

## Examples
Here are various examples to inspire you to build your own transformers.

```typescript
const { transformers, registry } = defineTransformers({
  Trim: (value) =>
    typeof value === 'string' ? value.trim() : value,

  Truncate: (value, maxLength: number, suffix: string = '...') => {
    if (typeof value !== 'string') return value
    if (value.length <= maxLength) return value
    return value.substring(0, maxLength - suffix.length) + suffix
  },

  Slugify: (value) => {
    if (typeof value !== 'string') return value
    return value
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
  },

  Capitalize: (value) => {
    if (typeof value !== 'string') return value
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
  },

  SortBy: (value, property?: string, order: 'asc' | 'desc' = 'asc') => {
    if (!Array.isArray(value)) return value

    const sorted = [...value].sort((a, b) => {
      const aVal = property ? a[property] : a
      const bVal = property ? b[property] : b

      if (aVal < bVal) return order === 'asc' ? -1 : 1
      if (aVal > bVal) return order === 'asc' ? 1 : -1
      return 0
    })

    return sorted
  },

  MaskSensitive: (value, showLast: number = 4, maskChar: string = '*') => {
    if (typeof value !== 'string' || value.length <= showLast) return value
    const masked = maskChar.repeat(value.length - showLast)
    return masked + value.slice(-showLast)
  },

  CalculateAge: (value, referenceDate?: string) => {
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
})
```

### Async Transformers
For transformers that need to perform asynchronous operations:

> [!IMPORTANT]
> Async transformers should be used sparingly as they can impact form performance.
> Consider whether the transformation can be done at the data source level instead.

```typescript
const { transformers, registry } = defineTransformers({
  FetchUserName: async (userId: string) => {
    const response = await fetch(`/api/users/${userId}`)
    const user = await response.json()
    return user.name
  },

  TranslateText: async (value, targetLanguage: string) => {
    if (typeof value !== 'string') return value
    const response = await translationService.translate(value, targetLanguage)
    return response.translatedText
  }
})
```

### Transformers with Dependencies
For transformers that need external dependencies, use `defineTransformersWithDeps`:

```typescript
import { defineTransformersWithDeps } from '@form-engine/registry/utils/createRegisterableFunction'

const deps = {
  formatter: new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }),
  dateFormatter: new Intl.DateTimeFormat('en-GB'),
  apiClient: new ApiClient()
}

const { transformers, registry } = defineTransformersWithDeps(deps, {
  FormatCurrency: (deps) => (value: number) => {
    if (typeof value !== 'number') return value
    return deps.formatter.format(value)
  },

  FormatDate: (deps) => (value: string | Date) => {
    if (!value) return value
    const date = new Date(value)
    if (isNaN(date.getTime())) return value
    return deps.dateFormatter.format(date)
  },

  EnrichWithApiData: (deps) => async (value: string, endpoint: string) => {
    const data = await deps.apiClient.get(endpoint, { id: value })
    return { ...value, ...data }
  }
})
```

## Using Transformers in Pipelines
Transformers are commonly used in pipeline expressions to chain multiple transformations:

```typescript
// Single transformation
value: Answer('phone').pipe(transformers.ExtractNumbers())

// Chained transformations
value: Answer('email').pipe(
  transformers.Trim(),
  transformers.ToLowerCase(),
  transformers.MaskSensitive(4, '*')
)
```

## Registration

Transformers must be registered with the FormEngine to be available for use in forms.
Registration typically happens during application initialization:

```typescript
import FormEngine from '@form-engine/core/FormEngine'
import { defineTransformers } from '@form-engine/registry/utils/createRegisterableFunction'

// Define your custom transformers
const { transformers: CustomTransformers, registry: CustomTransformersRegistry } = defineTransformers({
  FormatCurrency: (value: number, currency: string = 'GBP') => {
    // implementation
  },
  ExtractPostcode: (value: string) => {
    // implementation
  },
  CalculateTotal: (items: any[]) => {
    // implementation
  }
})

// Create the form engine instance
const formEngine = new FormEngine()

// Register the transformers using the registry
formEngine.registerFunctions(CustomTransformersRegistry)

// Export transformers for use in form definitions
export { CustomTransformers }
```

### Registration Notes
- Built-in transformers (like `toUpperCase`, `trim`, `split`) are registered automatically unless disabled via options
- Functions are stored by their `name` property in the FunctionRegistry
- Attempting to register a duplicate name will throw a `RegistryDuplicateError`
- Invalid function specs will throw a `RegistryValidationError`

## Error Handling
Transformers should handle errors gracefully and return sensible defaults:
> [!WARNING]
> I probably want to add custom Error types for this, so the form engine can catch them and handle
> them more neatly

```typescript
const { transformers, registry } = defineTransformers({
  SafeParseJSON: (value) => {
    if (typeof value !== 'string') return value
    try {
      return JSON.parse(value)
    } catch {
      // Return original value on parse error
      return value
    }
  },

  SafeDivide: (value, divisor: number) => {
    if (typeof value !== 'number') return value
    if (divisor === 0) return 0 // Or null, or throw custom error
    return value / divisor
  },

  SafeDateFormat: (value, format: string) => {
    try {
      const date = new Date(value)
      if (isNaN(date.getTime())) return value
      // Format the date...
      return formattedDate
    } catch (error) {
      console.warn('Date formatting failed:', error)
      return value // Return original on error
    }
  }
})
```

## Best Practices

### 1. Naming Conventions
Use descriptive PascalCase names that clearly indicate the transformation:

```typescript
// Good
ToUpperCase
FormatCurrency
ExtractPostcode
CalculateTotal

// Avoid
transform1
processData
doStuff
```

### 2. Immutability
Never modify the input value directly; always return a new value:

```typescript
const { transformers, registry } = defineTransformers({
  // Bad - mutates input (input will likely be READONLY somehow, proxy?)
  BadAddProperty: (value, key: string, val: any) => {
    value[key] = val  // Mutates original!
    return value
  },

  // Good - returns new object
  AddProperty: (value, key: string, val: any) => {
    if (typeof value !== 'object' || value === null) return value
    return { ...value, [key]: val }  // New object
  }
})
```

### 3. Type Safety
Always check input types and handle unexpected inputs gracefully:

```typescript
const { transformers, registry } = defineTransformers({
  AppendString: (value, suffix: string) => {
    // Handle non-string inputs gracefully
    if (typeof value !== 'string') return value
    return value + suffix
  }
})
```

### 4. Composability
Design transformers to work well in pipelines:

```typescript
const { transformers, registry } = defineTransformers({
  // Small, focused transformers that compose well
  Trim: (v) => typeof v === 'string' ? v.trim() : v,
  ToLowerCase: (v) => typeof v === 'string' ? v.toLowerCase() : v,
  RemoveSpaces: (v) => typeof v === 'string' ? v.replace(/\s/g, '') : v
})

// Can be combined in various ways
value: Answer('code').pipe(
  transformers.Trim(),
  transformers.ToLowerCase(),
  transformers.RemoveSpaces()
)
```

## JSON Output

When custom transformers are used in form configuration, they compile to the standard function format:

```typescript
// Usage in configuration
value: Answer('price').pipe(
  transformers.Multiply(1.2),
  transformers.FormatCurrency('GBP')
)

// Compiles to JSON
{
  type: 'ExpressionType.Pipeline',
  input: { type: 'ExpressionType.Reference', path: ['answers', 'price'] },
  steps: [
    {
      type: 'FunctionType.Transformer',
      name: 'Multiply',
      arguments: [1.2]
    },
    {
      type: 'FunctionType.Transformer',
      name: 'FormatCurrency',
      arguments: ['GBP']
    }
  ]
}
```

The form engine will look up each transformer function by name in the registry and
execute them in sequence, passing the output of each as input to the next.
