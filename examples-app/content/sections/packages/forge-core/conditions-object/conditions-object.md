---
title: Objects
section: packages
path: packages/forge-core/conditions-object
teaches: [condition::object, object-conditions]
prerequisites: [forge-core, conditions]
---

<p class="govuk-caption-xl">Forge Core</p>

# Object conditions
Object conditions test the structure of objects - whether a value is
an object, whether it has a property, and whether that property has
a value. They are useful for validating composite fields and
checking loaded data.

{{slot:toc}}

---

## How to use them

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};

self_().matches(condition::object::is_object())
data("record").matches(condition::object::has_property("address.line1"))
data("record").matches(condition::object::property_has_value("email"))
```

---

## Conditions

### IsObject

Returns true if the value is a plain object (not null, not an
array).

```rust
self_().matches(condition::object::is_object())
// {} -> true, { a: 1 } -> true
// null -> false, [] -> false, "string" -> false
```

### HasProperty

Returns true if the object has a property at the given path.
Supports dot notation for nested properties.

```rust
data("user").matches(condition::object::has_property("address"))
data("user").matches(condition::object::has_property("address.postcode"))
```

### PropertyIsEmpty

Returns true if the property at the given path is null, undefined,
or an empty string (after trimming).

```rust
data("record").matches(condition::object::property_is_empty("notes"))
```

### PropertyHasValue

Returns true if the property at the given path has a non-empty
value. The inverse of `PropertyIsEmpty`.

```rust
data("record").matches(condition::object::property_has_value("email"))
```

---

## Practical examples

### Conditionally show a section based on loaded data

```rust
govuk::SUMMARY_LIST.build(obj! {
    "rows": address_rows,
    "visibleWhen": data("record").matches(condition::object::property_has_value("address.line1")),
})
```

### Validate a composite field has all parts

```rust
"validWhen": [
    validation(obj! {
        "condition": self_().matches(condition::object::property_has_value("year")),
        "message": "Enter a year",
    }),
    validation(obj! {
        "condition": self_().matches(condition::object::property_has_value("month")),
        "message": "Enter a month",
    }),
    validation(obj! {
        "condition": self_().matches(condition::object::property_has_value("day")),
        "message": "Enter a day",
    }),
],
```
