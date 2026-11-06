---
title: Item (Iterators)
section: authoring-language
path: authoring-language/item
teaches: [item, item-path, item-value, item-key, item-parent]
prerequisites: [iterator, each, iterator::map, iterator::filter, iterator::find]
---

<p class="govuk-caption-xl">References</p>

# Item (Iterators)

`item()` references the current item inside an `.each()` iteration.
Where `answer()` references a field and `data()` references step
data, `item()` references whatever the iterator is currently
pointing at.

{{slot:toc}}

---

## What is Item?

When you iterate over a collection with `.each()`, you need a way
to refer to each item as the iteration processes it. `item()` is
that reference. It only has meaning inside an iterator. Outside
one, it has nothing to resolve to.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};

item().path("country")
```

---

## How it works

Inside an `.each()` call, `item()` resolves to the current item on
each pass through the collection. If the collection is an array of
objects, `item().path("name")` gives you the `name` property of
whichever object the iterator is currently on.

`item()` is scoped to its iterator. In nested iterations,
`item()` always refers to the innermost one. Use `item().parent()`
to reach the outer item.

Iterator metadata is separate from item data. `item()` reads values
from the current item. Use [Loop](loop) when you need metadata about
the current iterator, such as the current position, whether the item
is first or last, or the total number of processed items.

---

## Using in your definitions

### Accessing item properties

Use `.path()` to navigate into the current item's properties:

```rust
answer("trips").each(iterator::map(govuk::SUMMARY_LIST.build(obj! {
    "card": obj! {
        "title": obj! { "text": item().path("country") },
    },
    "rows": [
        obj! {
            "key": obj! { "text": "Departure date" },
            "value": obj! { "text": item().path("departureDate") },
        },
        obj! {
            "key": obj! { "text": "Return date" },
            "value": obj! { "text": item().path("returnDate") },
        },
    ],
})))
```

### Primitive collections

When the collection contains simple values rather than objects,
`item().value()` gives you the raw value:

```rust
data("tags").each(iterator::map(govuk::TAG.build(obj! { "text": item().value() })))
```

### Nested iteration

When items themselves contain collections, you can nest `.each()`
calls. Inside the inner iterator, `item()` refers to the inner
item. Use `item().parent()` to reach the outer scope:

```rust
data("teams").each(iterator::map(obj! {
    "teamName": item().path("name"),
    "members": item().path("members").each(iterator::map(obj! {
        "memberName": item().path("name"),
        "team": item().parent().path("name"),
    })),
}))
```

Use [Loop.Parent](loop) when you need metadata from the outer
iterator.

---

## API surface

### `item()`

Creates a reference to the current item in an `.each()` iteration.
Takes no arguments. Must be used inside an iterator.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
```

Returns a scoped reference with the following methods:

### `.path(key)`

Navigates to a property within the current item. Supports dot
notation.

```rust
item().path("address.postcode")
```

### `.value()`

The current item's raw value. Useful when iterating over
primitives rather than objects.

### `.key()`

The current key when iterating over an object's entries rather
than an array.

### `.parent`

References the outer iterator's item in nested iterations. This is
lowercase because it belongs to `item()`:

```rust
item().parent().path("teamName")
```

Use `Loop.parent()` when you need metadata from the outer iterator
instead.

## Best practices

- **Use `.path()` for object collections, `.value()` for
  primitives.** If each item is an object, navigate with `.path()`.
  If the collection is a flat array of strings or numbers, use
  `.value()`.
- **Keep item data and loop metadata separate.** Use `item()` for
  properties on the current item and [Loop](loop) for iterator
  metadata such as indexes, first/last, and length.
- **Avoid deep item nesting.** If a block needs data from multiple
  ancestor items, consider shaping the data in an effect before
  passing it to the definition. The same applies to deeply nested
  [Loop.Parent](loop) metadata.
