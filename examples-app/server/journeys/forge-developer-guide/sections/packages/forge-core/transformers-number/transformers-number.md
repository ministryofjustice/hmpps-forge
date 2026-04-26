---
title: Numbers
section: packages
path: packages/forge-core/transformers-number
teaches: [Transformer.Number, number-transformers]
prerequisites: [forge-core, transformers]
---

<p class="govuk-caption-xl">Forge Core</p>

# Number transformers
Number transformers perform mathematical operations and formatting
on numeric values. They are applied through `.pipe()` on references
and expressions that resolve to numbers.

{{slot:toc}}

---

## How to use them

Number transformers are called as `Transformer.Number.<Name>()` and
applied with `.pipe()`:

```typescript
import { Data, Transformer } from '@ministryofjustice/hmpps-forge/core/authoring'

Data('price').pipe(Transformer.Number.Add(10))
Data('total').pipe(Transformer.Number.ToFixed(2))
Data('score').pipe(Transformer.Number.Clamp(0, 100))
```

You can chain multiple transformers in sequence:

```typescript
Data('rawScore')
  .pipe(Transformer.Number.Multiply(100))
  .pipe(Transformer.Number.Round())
  .pipe(Transformer.Number.Clamp(0, 100))
```

All arguments that accept a number also accept an expression, so you
can use dynamic values:

```typescript
Data('price').pipe(Transformer.Number.Multiply(Answer('quantity')))
```

---

## Arithmetic

### Add

Adds a number to the input value.

```typescript
Data('subtotal').pipe(Transformer.Number.Add(5))
// 10 -> 15
```

### Subtract

Subtracts a number from the input value.

```typescript
Data('total').pipe(Transformer.Number.Subtract(3))
// 10 -> 7
```

### Multiply

Multiplies the input value by a number.

```typescript
Data('price').pipe(Transformer.Number.Multiply(Answer('quantity')))
// 25 with quantity 4 -> 100
```

### Divide

Divides the input value by a number. Throws if the divisor is zero.

```typescript
Data('total').pipe(Transformer.Number.Divide(2))
// 10 -> 5
```

### Power

Raises the input value to the power of the exponent.

```typescript
Data('side').pipe(Transformer.Number.Power(2))
// 5 -> 25
```

### Sqrt

Returns the square root of the input value. Throws if the value is
negative.

```typescript
Data('area').pipe(Transformer.Number.Sqrt())
// 16 -> 4
```

---

## Rounding

### Round

Rounds the number to the nearest integer.

```typescript
Data('score').pipe(Transformer.Number.Round())
// 4.7 -> 5, 4.3 -> 4
```

### Floor

Rounds the number down to the nearest integer.

```typescript
Data('score').pipe(Transformer.Number.Floor())
// 4.7 -> 4
```

### Ceil

Rounds the number up to the nearest integer.

```typescript
Data('score').pipe(Transformer.Number.Ceil())
// 4.2 -> 5
```

### ToFixed

Rounds the number to a specified number of decimal places. Returns
a number, not a string.

```typescript
Data('price').pipe(Transformer.Number.ToFixed(2))
// 3.14159 -> 3.14
```

---

## Clamping and comparison

### Abs

Returns the absolute value of the input.

```typescript
Data('difference').pipe(Transformer.Number.Abs())
// -5 -> 5
```

### Max

Returns the greater of the input value and the comparison value.

```typescript
Data('score').pipe(Transformer.Number.Max(0))
// -3 -> 0, 5 -> 5
```

### Min

Returns the lesser of the input value and the comparison value.

```typescript
Data('score').pipe(Transformer.Number.Min(100))
// 150 -> 100, 80 -> 80
```

### Clamp

Clamps the input value between a minimum and maximum (inclusive).
Equivalent to chaining `Max(min)` then `Min(max)`.

```typescript
Data('score').pipe(Transformer.Number.Clamp(0, 100))
// -5 -> 0, 50 -> 50, 150 -> 100
```

---

## Practical examples

### Pagination offset

Calculate the next and previous page numbers for pagination links:

```typescript
import { Data, Format, Transformer } from '@ministryofjustice/hmpps-forge/core/authoring'

Format('?page=%1', Data('currentPage').pipe(Transformer.Number.Add(1)))
Format('?page=%1', Data('currentPage').pipe(Transformer.Number.Add(-1)))
```

### Price calculation

Multiply a unit price by a quantity and round to two decimal places:

```typescript
Data('unitPrice')
  .pipe(Transformer.Number.Multiply(Answer('quantity')))
  .pipe(Transformer.Number.ToFixed(2))
```

### Percentage score

Convert a raw score to a percentage, clamped between 0 and 100:

```typescript
Data('rawScore')
  .pipe(Transformer.Number.Divide(Data('maxScore')))
  .pipe(Transformer.Number.Multiply(100))
  .pipe(Transformer.Number.Round())
  .pipe(Transformer.Number.Clamp(0, 100))
```
