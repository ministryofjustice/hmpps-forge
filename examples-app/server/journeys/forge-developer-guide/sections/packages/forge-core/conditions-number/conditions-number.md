---
title: Numbers
section: packages
path: packages/forge-core/conditions-number
teaches: [Condition.Number, number-conditions]
prerequisites: [forge-core, conditions]
---

<p class="govuk-caption-xl">Forge Core</p>

# Number conditions
Number conditions test numeric values - type checks, comparisons,
and range checks. They are used with `.match()` in validation rules,
`visibleWhen` predicates, and conditional expressions.

{{slot:toc}}

---

## How to use them

Number conditions are called as `Condition.Number.<Name>()` and
tested with `.match()`:

```typescript
import { Self, Answer, Data, Condition } from '@ministryofjustice/hmpps-forge/core/authoring'

Self().match(Condition.Number.IsNumber())
Answer('age').match(Condition.Number.GreaterThanOrEqual(18))
Data('currentPage').match(Condition.Number.LessThan(Data('totalPages')))
```

All arguments that accept a number also accept an expression, so
thresholds can be dynamic:

```typescript
Answer('quantity').match(Condition.Number.Between(1, Data('maxStock')))
```

---

## Type checks

### IsNumber

Returns true if the value is a valid number (not NaN, not a string,
not undefined). Use this to verify that a formatter like
`Transformer.String.ToInt()` successfully converted the input.

```typescript
validation({
  condition: Self().match(Condition.Number.IsNumber()),
  message: 'Enter a valid number',
})
```

### IsInteger

Returns true if the value is a whole number with no decimal part.

```typescript
validation({
  condition: Self().match(Condition.Number.IsInteger()),
  message: 'Enter a whole number',
})
```

---

## Comparisons

### GreaterThan

Returns true if the value is strictly greater than the threshold.

```typescript
Answer('age').match(Condition.Number.GreaterThan(0))
// 5 -> true, 0 -> false, -1 -> false
```

### GreaterThanOrEqual

Returns true if the value is greater than or equal to the threshold.

```typescript
Answer('age').match(Condition.Number.GreaterThanOrEqual(18))
// 18 -> true, 19 -> true, 17 -> false
```

### LessThan

Returns true if the value is strictly less than the threshold.

```typescript
Data('currentPage').match(
  Condition.Number.LessThan(Data('pages').pipe(Transformer.Array.Length())),
)
```

### LessThanOrEqual

Returns true if the value is less than or equal to the threshold.

```typescript
Answer('quantity').match(Condition.Number.LessThanOrEqual(100))
// 100 -> true, 50 -> true, 101 -> false
```

### Between

Returns true if the value is between the minimum and maximum,
inclusive on both ends.

```typescript
Answer('score').match(Condition.Number.Between(1, 10))
// 1 -> true, 5 -> true, 10 -> true, 0 -> false, 11 -> false
```

---

## Practical examples

### Validate a numeric field

Chain `ToInt` as a formatter with `IsNumber` and range checks as
validation rules:

```typescript
GovUKTextInput({
  code: 'quantity',
  label: { text: 'Quantity' },
  formatters: [Transformer.String.ToInt()],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter a quantity',
    }),
    validation({
      condition: Self().match(Condition.Number.IsNumber()),
      message: 'Enter a valid number',
    }),
    validation({
      condition: Self().match(Condition.Number.Between(1, 999)),
      message: 'Quantity must be between 1 and 999',
    }),
  ],
})
```

### Conditional pagination controls

Show previous/next links only when there are pages to navigate to:

```typescript
previous: {
  href: Format('?page=%1', Data('currentPage').pipe(Transformer.Number.Add(-1))),
  visibleWhen: Data('currentPage').match(Condition.Number.GreaterThan(1)),
},
next: {
  href: Format('?page=%1', Data('currentPage').pipe(Transformer.Number.Add(1))),
  visibleWhen: Data('currentPage').match(
    Condition.Number.LessThan(Data('pages').pipe(Transformer.Array.Length())),
  ),
},
```

### Dynamic threshold from loaded data

Compare against a value loaded by an effect rather than a static
number:

```typescript
Answer('requestedAmount').match(
  Condition.Number.LessThanOrEqual(Data('availableBudget')),
)
```
