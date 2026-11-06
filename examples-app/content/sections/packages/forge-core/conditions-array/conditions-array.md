---
title: Arrays
section: packages
path: packages/forge-core/conditions-array
teaches: [condition::array, array-conditions]
prerequisites: [forge-core, conditions]
---

<p class="govuk-caption-xl">Forge Core</p>

# Array conditions
Array conditions test membership and containment - whether a value
is in a list, whether a list contains a value, and whether lists
overlap. They are used for checkbox validation, role checks, and
filtering logic.

{{slot:toc}}

---

## How to use them

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};

answer("role").matches(condition::array::is_in(["admin", "editor"]))
answer("selectedTags").matches(condition::array::contains("urgent"))
session("roles").matches(condition::array::contains_any(["admin", "superuser"]))
```

---

## Conditions

### IsArray

Tests whether a given value is an array.

```rust
answer("status").matches(condition::array::is_array())
// ["this", "is", "an", "array"] -> true, "this is not an array" -> false
```

### IsIn

Tests whether a single value exists in a given array. The value
being tested is the left side; the array to search is the argument.

```rust
answer("status").matches(condition::array::is_in(["active", "pending"]))
// "active" -> true, "closed" -> false
```

Useful for branching on one of several accepted values:

```rust
redirect(obj! {
    "when": answer("preference").matches(condition::array::is_in(["email", "text"])),
    "goto": "contact-details",
})
```

### Contains

Tests whether an array contains a specific value. The array is the
left side; the value to find is the argument.

```rust
answer("selectedOptions").matches(condition::array::contains("other"))
// ["email", "other"] -> true, ["email", "phone"] -> false
```

### ContainsAny

Tests whether an array contains at least one value from another
array.

```rust
session("roles").matches(condition::array::contains_any(["admin", "manager"]))
// ["admin", "viewer"] -> true, ["viewer"] -> false
```

### ContainsAll

Tests whether every item in the value array exists in the expected
array. Order does not matter. Returns true for empty value arrays.

```rust
answer("selected").matches(condition::array::contains_all(["a", "b", "c", "d"]))
// ["a", "c"] -> true (both exist in expected)
// ["a", "x"] -> false (x not in expected)
```

---

## Practical examples

### Checkbox must include a specific option

```rust
validation(obj! {
    "condition": self_().matches(condition::array::contains("consent")),
    "message": "You must agree to the terms",
})
```

### Role-based access

Show a block only when the user has an admin or manager role:

```rust
govuk::BUTTON.build(obj! {
    "text": "Delete record",
    "visibleWhen": session("roles").matches(condition::array::contains_any(["admin", "manager"])),
})
```

### Branching on multiple accepted answers

```rust
redirect(obj! {
    "when": answer("channel").matches(condition::array::is_in(["email", "text", "letter"])),
    "goto": "contact-preferences",
})
```
