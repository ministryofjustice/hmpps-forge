---
title: Numbers
section: packages
path: packages/forge-core/conditions-number
teaches: [condition::number, number-conditions]
prerequisites: [forge-core, conditions]
---

<p class="govuk-caption-xl">Forge Core</p>

# Number conditions
Number conditions test numeric values - type checks, comparisons,
and range checks. They are used with `.matches()` in validation rules,
`visibleWhen` predicates, and conditional expressions.

{{slot:toc}}

---

## How to use them

Number conditions are called as `condition::number::<name>()` and
tested with `.matches()`:

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};

self_().matches(condition::number::is_number())
answer("age").matches(condition::number::greater_than_or_equal(18))
data("currentPage").matches(condition::number::less_than(data("totalPages")))
```

All arguments that accept a number also accept an expression, so
thresholds can be dynamic:

```rust
answer("quantity").matches(condition::number::between(1, data("maxStock")))
```

---

## Type checks

### IsNumber

Returns true if the value is a valid number (not NaN, not a string,
not undefined). Use this to verify that a formatter like
`transformer::string::to_int()` successfully converted the input.

```rust
validation(obj! {
    "condition": self_().matches(condition::number::is_number()),
    "message": "Enter a valid number",
})
```

### IsInteger

Returns true if the value is a whole number with no decimal part.

```rust
validation(obj! {
    "condition": self_().matches(condition::number::is_integer()),
    "message": "Enter a whole number",
})
```

---

## Comparisons

### GreaterThan

Returns true if the value is strictly greater than the threshold.

```rust
answer("age").matches(condition::number::greater_than(0))
// 5 -> true, 0 -> false, -1 -> false
```

### GreaterThanOrEqual

Returns true if the value is greater than or equal to the threshold.

```rust
answer("age").matches(condition::number::greater_than_or_equal(18))
// 18 -> true, 19 -> true, 17 -> false
```

### LessThan

Returns true if the value is strictly less than the threshold.

```rust
data("currentPage").matches(condition::number::less_than(data("pages").pipe([transformer::array::length()])))
```

### LessThanOrEqual

Returns true if the value is less than or equal to the threshold.

```rust
answer("quantity").matches(condition::number::less_than_or_equal(100))
// 100 -> true, 50 -> true, 101 -> false
```

### Between

Returns true if the value is between the minimum and maximum,
inclusive on both ends.

```rust
answer("score").matches(condition::number::between(1, 10))
// 1 -> true, 5 -> true, 10 -> true, 0 -> false, 11 -> false
```

---

## Practical examples

### Validate a numeric field

Chain `ToInt` as a formatter with `IsNumber` and range checks as
validation rules:

```rust
govuk::TEXT_INPUT.build(obj! {
    "code": "quantity",
    "label": obj! { "text": "Quantity" },
    "formatters": [transformer::string::to_int()],
    "validWhen": [
        validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Enter a quantity",
        }),
        validation(obj! {
            "condition": self_().matches(condition::number::is_number()),
            "message": "Enter a valid number",
        }),
        validation(obj! {
            "condition": self_().matches(condition::number::between(1, 999)),
            "message": "Quantity must be between 1 and 999",
        }),
    ],
})
```

### Conditional pagination controls

Show previous/next links only when there are pages to navigate to:

```rust
"previous": obj! {
    "href": format("?page=%1", [data("currentPage").pipe([transformer::number::add(-1)]).into()]),
    "visibleWhen": data("currentPage").matches(condition::number::greater_than(1)),
},
"next": obj! {
    "href": format("?page=%1", [data("currentPage").pipe([transformer::number::add(1)]).into()]),
    "visibleWhen": data("currentPage").matches(condition::number::less_than(data("pages").pipe([transformer::array::length()]))),
},
```

### Dynamic threshold from loaded data

Compare against a value loaded by an effect rather than a static
number:

```rust
answer("requestedAmount").matches(condition::number::less_than_or_equal(data("availableBudget")))
```
