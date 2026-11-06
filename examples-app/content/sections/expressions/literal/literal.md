---
title: Literal
section: authoring-language
path: authoring-language/literal
teaches: [literal, static-values, chainable-static]
prerequisites: [each, iterator, pipe]
---

<p class="govuk-caption-xl">Expressions</p>

# Literal

`literal()` wraps a static value so it can be used where Forge
expects an expression. It's the bridge between plain Rust
values and Forge's expression system.

{{slot:toc}}

---

## What is Literal?

References like `answer()` and `data()` resolve values at runtime.
But sometimes you already have the value and need to use it with
expression features like `.each()`, `.matches()`, or `.pipe()`.
`literal()` wraps a static value so Forge treats it as an
expression.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};

literal(["apple", "banana", "cherry"])
```

The most common use is making a static array iterable. `data()`
and `answer()` references are already expressions, so they work
with `.each()` directly. But a plain Rust array is not an
expression, so it needs `literal()` first.

---

## Using in your definitions

### Iterating over static arrays

When the data lives in your code rather than in step data or an
effect, wrap it with `literal()` to iterate over it:

```rust
let areas_of_need = [
    obj! { "value": "accommodation", "text": "Accommodation" },
    obj! { "value": "education", "text": "Education, training and employment" },
    obj! { "value": "finance", "text": "Finance" },
    obj! { "value": "health", "text": "Health and wellbeing" },
];
govuk::CHECKBOX_INPUT.build(obj! {
    "code": "selectedAreas",
    "fieldset": obj! { "legend": obj! { "text": "Select areas of need" } },
    "items": literal(areas_of_need).each(iterator::map(obj! {
        "value": item().path("value"),
        "text": item().path("text"),
    })),
})
```

Without `literal()`, you could achieve the same by putting the
array in the step's `data` property and using `data("areasOfNeed")`.
`literal()` is a shortcut when the data is small and co-located
with the block that uses it.

### Static collections in CollectionBlock

`literal()` works the same way with `core_blocks::COLLECTION_BLOCK`:

```rust
core_blocks::COLLECTION_BLOCK.build(obj! {
    "collection": literal(table_rows).each(iterator::map(my_row_component)),
})
```

### Using with conditions

You can also use `literal()` to test a static value against a
condition:

```rust
literal(items).pipe([transformer::array::length()]).matches(condition::number::greater_than(0))
```

---

## API surface

### `literal(value)`

Wraps a static value as an expression.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
```

`value` can be any serialisable value: a string, number, boolean,
array, or plain object.

Returns a chainable expression that supports `.path()`, `.matches()`,
`.pipe()`, and `.each()`.

---

## Best practices

- **Prefer `data` or `data()` for most static values.** If the
  value is used across multiple blocks or steps, the step or journey's `data`
  property is a better home. `literal()` is best for small,
  one-off values co-located with the block that uses them.
- **Keep literal values serialisable.** Forge definitions must be
  serialisable. Functions, class instances, and circular references
  inside a `literal()` will fail validation at startup.
