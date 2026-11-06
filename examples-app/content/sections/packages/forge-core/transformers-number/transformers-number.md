---
title: Numbers
section: packages
path: packages/forge-core/transformers-number
teaches: [transformer::number, number-transformers]
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

Number transformers are called as `transformer::number::<name>()` and
applied with `.pipe()`:

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};

data("price").pipe([transformer::number::add(10)])
data("total").pipe([transformer::number::to_fixed(2)])
data("score").pipe([transformer::number::clamp(0, 100)])
```

You can chain multiple transformers in sequence:

```rust
data("rawScore").pipe([transformer::number::multiply(100)]).pipe([transformer::number::round()]).pipe([transformer::number::clamp(0, 100)])
```

All arguments that accept a number also accept an expression, so you
can use dynamic values:

```rust
data("price").pipe([transformer::number::multiply(answer("quantity"))])
```

---

## Arithmetic

### Add

Adds a number to the input value.

```rust
data("subtotal").pipe([transformer::number::add(5)])
// 10 -> 15
```

### Subtract

Subtracts a number from the input value.

```rust
data("total").pipe([transformer::number::subtract(3)])
// 10 -> 7
```

### Multiply

Multiplies the input value by a number.

```rust
data("price").pipe([transformer::number::multiply(answer("quantity"))])
// 25 with quantity 4 -> 100
```

### Divide

Divides the input value by a number. Throws if the divisor is zero.

```rust
data("total").pipe([transformer::number::divide(2)])
// 10 -> 5
```

### Power

Raises the input value to the power of the exponent.

```rust
data("side").pipe([transformer::number::power(2)])
// 5 -> 25
```

### Sqrt

Returns the square root of the input value. Throws if the value is
negative.

```rust
data("area").pipe([transformer::number::sqrt()])
// 16 -> 4
```

---

## Rounding

### Round

Rounds the number to the nearest integer.

```rust
data("score").pipe([transformer::number::round()])
// 4.7 -> 5, 4.3 -> 4
```

### Floor

Rounds the number down to the nearest integer.

```rust
data("score").pipe([transformer::number::floor()])
// 4.7 -> 4
```

### Ceil

Rounds the number up to the nearest integer.

```rust
data("score").pipe([transformer::number::ceil()])
// 4.2 -> 5
```

### ToFixed

Rounds the number to a specified number of decimal places. Returns
a number, not a string.

```rust
data("price").pipe([transformer::number::to_fixed(2)])
// 3.14159 -> 3.14
```

---

## Clamping and comparison

### Abs

Returns the absolute value of the input.

```rust
data("difference").pipe([transformer::number::abs()])
// -5 -> 5
```

### Max

Returns the greater of the input value and the comparison value.

```rust
data("score").pipe([transformer::number::max(0)])
// -3 -> 0, 5 -> 5
```

### Min

Returns the lesser of the input value and the comparison value.

```rust
data("score").pipe([transformer::number::min(100)])
// 150 -> 100, 80 -> 80
```

### Clamp

Clamps the input value between a minimum and maximum (inclusive).
Equivalent to chaining `transformer::number::max(min)` then `transformer::number::min(max)`.

```rust
data("score").pipe([transformer::number::clamp(0, 100)])
// -5 -> 0, 50 -> 50, 150 -> 100
```

---

## Practical examples

### Pagination offset

Calculate the next and previous page numbers for pagination links:

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};

format("?page=%1", [data("currentPage").pipe([transformer::number::add(1)]).into()])
format("?page=%1", [data("currentPage").pipe([transformer::number::add(-1)]).into()])
```

### Price calculation

Multiply a unit price by a quantity and round to two decimal places:

```rust
data("unitPrice").pipe([transformer::number::multiply(answer("quantity"))]).pipe([transformer::number::to_fixed(2)])
```

### Percentage score

Convert a raw score to a percentage, clamped between 0 and 100:

```rust
data("rawScore").pipe([transformer::number::divide(data("maxScore"))]).pipe([transformer::number::multiply(100)]).pipe([transformer::number::round()]).pipe([transformer::number::clamp(0, 100)])
```
