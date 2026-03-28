# Transformers

Transformers modify values - cleaning strings, converting types, formatting dates, computing derived values. They run in field formatters (after submission, before validation) and in expression pipelines.

## What is a Transformer?

A transformer is a function that takes a value and returns a modified version of it. Unlike conditions (which test values) or generators (which create values), transformers modify existing values - cleaning, formatting, converting, or computing new values from them.

This enables:
- Cleaning field input (trimming whitespace, normalising case)
- Converting between types (string to number, date to ISO string)
- Computing derived values (adding days to dates, calculating totals)
- Processing collections (filtering, mapping, sorting arrays)

### Import

```typescript
import { Transformer } from '@form-engine/registry/transformers'
```

---

## Basic Usage

### Field Formatters

Add transformers to a field's `formatters` array. They run in order after submission, with each transformer's output becoming the next one's input:

```typescript
field<GovUKTextInput>({
  variant: 'govukTextInput',
  code: 'email',
  label: 'Email address',
  formatters: [
    Transformer.String.Trim(),        // "  tom@example.com  " → "tom@example.com"
    Transformer.String.ToLowerCase(), // "Tom@Example.COM" → "tom@example.com"
  ],
  validate: [
    validation({
      when: Self().not.match(Condition.IsRequired()),
      message: 'Enter your email address',
    }),
  ],
})
```

Formatters run after form submission but before validation, so validation rules see the cleaned values rather than raw user input. When a value passes through formatters, a `formatters` mutation is recorded in the answer history, allowing you to trace how values were transformed.

### Pipeline Chains

Use `.pipe()` to transform values in expressions:

```typescript
// Transform an answer for display
Answer('price').pipe(
  Transformer.Number.ToFixed(2)
)

// Chain multiple transformers
Answer('postcode').pipe(
  Transformer.String.Trim(),
  Transformer.String.ToUpperCase()
)

// Transform then test with a condition
Answer('quantity')
  .pipe(Transformer.String.ToInt())
  .match(Condition.Number.GreaterThan(0))
```

---

## Dynamic Arguments

Transformer arguments accept both static values and expressions:

```typescript
// Static: fixed values
Transformer.String.Substring(0, 10)
Transformer.Number.Multiply(1.2)

// Dynamic: values from other fields or data
Transformer.Number.Multiply(Answer('taxRate'))
Transformer.String.PadStart(Data('config.codeLength'), '0')
Transformer.Array.Slice(0, Answer('maxItems'))
```

---

## Common Patterns

### Email Normalisation

```typescript
field<GovUKTextInput>({
  code: 'email',
  label: 'Email address',
  formatters: [
    Transformer.String.Trim(),
    Transformer.String.ToLowerCase(),
  ],
})
// "  John.Smith@Example.COM  " → "john.smith@example.com"
```

### Postcode Formatting

```typescript
field<GovUKTextInput>({
  code: 'postcode',
  label: 'Postcode',
  formatters: [
    Transformer.String.Trim(),
    Transformer.String.ToUpperCase(),
  ],
})
// "  sw1a 2aa  " → "SW1A 2AA"
```

### Phone Number Cleaning

```typescript
field<GovUKTextInput>({
  code: 'phone',
  label: 'Phone number',
  formatters: [
    Transformer.String.Trim(),
    Transformer.String.Replace(' ', ''),
    Transformer.String.Replace('-', ''),
  ],
})
// "07700 900-123" → "07700900123"
```

### Percentage to Decimal

```typescript
field<GovUKTextInput>({
  code: 'discountRate',
  label: 'Discount rate (%)',
  formatters: [
    Transformer.String.ToFloat(),
    Transformer.Number.Divide(100),
  ],
})
// User enters "15" → stored as 0.15
```

### Date Input to ISO Format

```typescript
field<GovUKDateInputFull>({
  code: 'dateOfBirth',
  fieldset: { legend: { text: 'Date of birth' } },
  formatters: [
    Transformer.Object.ToISO({
      year: 'dateOfBirth-year',
      month: 'dateOfBirth-month',
      day: 'dateOfBirth-day',
    }),
  ],
})
// {day: "15", month: "3", year: "2024"} → "2024-03-15"
```

---

## Custom Transformers

### `defineTransformers()` - Without Dependencies

Create transformers that don't need external services:

```typescript
import { defineTransformers } from '@form-engine/registry/utils/createRegisterableFunction'
import { assertString, assertNumber } from '@form-engine/registry/utils/asserts'

export const { transformers: MyTransformers, registry: MyTransformersRegistry } = defineTransformers({
  // Simple transformer - no extra parameters
  NormalisePrisonNumber: value => {
    assertString(value, 'MyTransformers.NormalisePrisonNumber')
    return value.replace(/\s/g, '').toUpperCase()
  },

  // Transformer with parameters
  TruncateWithSuffix: (value, maxLength: number, suffix: string = '...') => {
    assertString(value, 'MyTransformers.TruncateWithSuffix')
    assertNumber(maxLength, 'MyTransformers.TruncateWithSuffix (maxLength)')
    assertString(suffix, 'MyTransformers.TruncateWithSuffix (suffix)')
    if (value.length <= maxLength) return value
    return value.substring(0, maxLength - suffix.length) + suffix
  },
})

// Registration
formEngine.registerFunctions(MyTransformersRegistry)

// Usage
formatters: [MyTransformers.NormalisePrisonNumber()]
```

### `defineTransformersWithDeps()` - With Dependencies

Create transformers that need access to external services:

```typescript
import { defineTransformersWithDeps } from '@form-engine/registry/utils/createRegisterableFunction'
import { assertString } from '@form-engine/registry/utils/asserts'

interface MyDeps {
  formatter: Intl.NumberFormat
  addressLookup: AddressLookupClient
}

export const { transformers: MyTransformers, createRegistry: createMyTransformersRegistry } =
  defineTransformersWithDeps<MyDeps>()({
    FormatCurrency: deps => (value: number) => {
      assertNumber(value, 'MyTransformers.FormatCurrency')
      return deps.formatter.format(value)
    },

    FormatPostcode: deps => async (value: string) => {
      assertString(value, 'MyTransformers.FormatPostcode')
      const result = await deps.addressLookup.formatPostcode(value)
      return result.formatted
    },
  })

// Registration - create registry with real deps at runtime
const registry = createMyTransformersRegistry({
  formatter: new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }),
  addressLookup: new AddressLookupClient(),
})
formEngine.registerFunctions(registry)
```

### Combining Registries

Merge multiple transformer registries:

```typescript
// Without dependencies
export const MyTransformersRegistry = {
  ...PrisonerTransformersRegistry,
  ...AddressTransformersRegistry,
}

// Mixed (some with deps, some without)
export const createMyTransformersRegistry = (deps: ApiDeps) => ({
  ...PrisonerTransformersRegistry,           // No deps
  ...createApiTransformersRegistry(deps),    // Needs deps
})
```

---

## Best Practices

### Use Assertions for Type Safety

Always validate input types to catch configuration errors early:

```typescript
import { assertString, assertNumber } from '@form-engine/registry/utils/asserts'

MyTransformer: (value, threshold: number) => {
  assertString(value, 'MyTransformer')
  assertNumber(threshold, 'MyTransformer (threshold)')
  return value.length > threshold ? value.substring(0, threshold) : value
}
```

### Keep Transformers Pure

Transformers should only transform values. Side effects belong in effects:

```typescript
// DO: Return transformed value
NormalisePostcode: value => {
  assertString(value, 'NormalisePostcode')
  return value.replace(/\s/g, '').toUpperCase()
}

// DON'T: Cause side effects
NormalisePostcode: value => {
  console.log('Normalising:', value)  // Side effect
  analytics.track('postcode_entered')  // Side effect
  return value.replace(/\s/g, '').toUpperCase()
}
```

### Return Immutably

Never modify the input value directly - always return a new value:

```typescript
// DO: Return new array
Reverse: value => {
  assertArray(value, 'Reverse')
  return [...value].reverse()
}

// DON'T: Mutate input
Reverse: value => {
  assertArray(value, 'Reverse')
  return value.reverse()  // Mutates original!
}
```

### Compose Small Transformers

Build small, focused transformers that do one thing well. Chain them for complex transformations:

```typescript
// DO: Small, composable transformers
formatters: [
  Transformer.String.Trim(),
  Transformer.String.ToUpperCase(),
  MyTransformers.RemoveSpaces(),
]

// DON'T: One transformer that does everything
formatters: [
  MyTransformers.CleanAndUppercaseAndRemoveSpaces(),
]
```

---

## Built-in Transformers Registry

### String Transformers

Namespace: `Transformer.String.*`

| Transformer | Parameters | Description | Example |
|-------------|------------|-------------|---------|
| `Trim()` | none | Remove leading/trailing whitespace | `"  hello  "` → `"hello"` |
| `ToUpperCase()` | none | Convert to uppercase | `"hello"` → `"HELLO"` |
| `ToLowerCase()` | none | Convert to lowercase | `"HELLO"` → `"hello"` |
| `ToTitleCase()` | none | Capitalize first letter of each word | `"hello world"` → `"Hello World"` |
| `Capitalize()` | none | Capitalize first letter only | `"hello world"` → `"Hello world"` |
| `Substring(start, end?)` | `start: number, end?: number` | Extract substring | `"hello".substring(1,4)` → `"ell"` |
| `Replace(search, replace)` | `search: string, replace: string` | Replace all occurrences | `"hello".replace("l", "x")` → `"hexxo"` |
| `PadStart(len, char?)` | `len: number, char?: string` | Pad left to length | `"5".padStart(3, "0")` → `"005"` |
| `PadEnd(len, char?)` | `len: number, char?: string` | Pad right to length | `"5".padEnd(3, "0")` → `"500"` |
| `ToInt()` | none | Convert to integer (throws on invalid) | `"123"` → `123` |
| `ToFloat()` | none | Convert to float (throws on invalid) | `"12.5"` → `12.5` |
| `ToArray(separator?)` | `separator?: string` | Split to array | `"a,b,c".split(",")` → `["a","b","c"]` |
| `ToDate()` | none | Parse UK date to Date object | `"15/03/2024"` → `Date` |
| `ToISODate()` | none | Convert UK date to ISO format | `"15/03/2024"` → `"2024-03-15"` |

### Number Transformers

Namespace: `Transformer.Number.*`

| Transformer | Parameters | Description | Example |
|-------------|------------|-------------|---------|
| `Add(n)` | `n: number` | Add to value | `5 + 3` → `8` |
| `Subtract(n)` | `n: number` | Subtract from value | `10 - 3` → `7` |
| `Multiply(n)` | `n: number` | Multiply value | `4 * 3` → `12` |
| `Divide(n)` | `n: number` | Divide value (throws on /0) | `15 / 3` → `5` |
| `Power(exp)` | `exp: number` | Raise to power | `2 ** 3` → `8` |
| `Sqrt()` | none | Square root (throws on negative) | `sqrt(16)` → `4` |
| `Abs()` | none | Absolute value | `abs(-5)` → `5` |
| `Round()` | none | Round to nearest integer | `4.7` → `5` |
| `Floor()` | none | Round down | `4.7` → `4` |
| `Ceil()` | none | Round up | `4.2` → `5` |
| `ToFixed(decimals)` | `decimals: number` | Round to decimal places | `3.14159.toFixed(2)` → `3.14` |
| `Max(n)` | `n: number` | Return larger of value and n | `max(5, 10)` → `10` |
| `Min(n)` | `n: number` | Return smaller of value and n | `min(5, 10)` → `5` |
| `Clamp(min, max)` | `min: number, max: number` | Constrain to range | `clamp(15, 0, 10)` → `10` |

### Array Transformers

Namespace: `Transformer.Array.*`

| Transformer | Parameters | Description | Example |
|-------------|------------|-------------|---------|
| `Length()` | none | Get array length | `[1,2,3].length` → `3` |
| `First()` | none | Get first element | `[1,2,3].first` → `1` |
| `Last()` | none | Get last element | `[1,2,3].last` → `3` |
| `Reverse()` | none | Reverse order (new array) | `[1,2,3]` → `[3,2,1]` |
| `Sort()` | none | Sort ascending (new array) | `[3,1,2]` → `[1,2,3]` |
| `Unique()` | none | Remove duplicates | `[1,2,2,3]` → `[1,2,3]` |
| `Flatten()` | none | Flatten one level | `[[1,2],[3,4]]` → `[1,2,3,4]` |
| `Join(separator?)` | `separator?: string` | Join to string | `[1,2,3].join(", ")` → `"1, 2, 3"` |
| `Slice(start, end?)` | `start: number, end?: number` | Extract portion | `[1,2,3,4].slice(1,3)` → `[2,3]` |
| `Concat(...arrays)` | `...arrays: any[][]` | Concatenate arrays | `[1,2].concat([3,4])` → `[1,2,3,4]` |
| `Filter(value)` | `value: any` | Keep matching elements | `[1,2,2,3].filter(2)` → `[2,2]` |
| `Map(property)` | `property: string \| number` | Extract property from each | `[{n:'a'},{n:'b'}].map('n')` → `['a','b']` |

### Date Transformers

Namespace: `Transformer.Date.*`

| Transformer | Parameters | Description | Example |
|-------------|------------|-------------|---------|
| `Format(format)` | `format: string` | Format to string | `Format('DD/MM/YYYY')` → `"15/03/2024"` |
| `ToISOString()` | none | Convert to ISO string | → `"2024-03-15T14:30:45.123Z"` |
| `ToLocaleString(locale?)` | `locale?: string` | Locale-specific string | → `"15/03/2024, 14:30:45"` |
| `AddDays(n)` | `n: number` | Add days | `AddDays(7)` adds one week |
| `SubtractDays(n)` | `n: number` | Subtract days | `SubtractDays(7)` subtracts one week |
| `AddMonths(n)` | `n: number` | Add months | `AddMonths(1)` adds one month |
| `AddYears(n)` | `n: number` | Add years | `AddYears(-18)` subtracts 18 years |
| `StartOfDay()` | none | Set to midnight | → `00:00:00.000` |
| `EndOfDay()` | none | Set to end of day | → `23:59:59.999` |

**Format tokens:** `YYYY` (4-digit year), `YY` (2-digit year), `MM` (2-digit month), `M` (month), `DD` (2-digit day), `D` (day), `HH` (2-digit hours), `H` (hours), `mm` (2-digit minutes), `m` (minutes), `ss` (2-digit seconds), `s` (seconds)

### Object Transformers

Namespace: `Transformer.Object.*`

| Transformer | Parameters | Description | Example |
|-------------|------------|-------------|---------|
| `ToISO(paths)` | `paths: {year?, month?, day?}` | Convert date parts to ISO string | `{day:"15",month:"3",year:"2024"}` → `"2024-03-15"` |
