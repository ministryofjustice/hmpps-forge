---
title: Loop (Iterators)
section: authoring-language
path: authoring-language/loop
teaches: [Loop, loop-index, loop-index0, loop-revindex, loop-first, loop-last, loop-length, loop-parent]
prerequisites: [iterator, each, iterator::map, item]
---

<p class="govuk-caption-xl">References</p>

# Loop (Iterators)

`Loop` references metadata about the current `.each()` iteration.
Where [Item](item) reads the value the iterator is currently pointing
at, `Loop` reads information about the iterator itself.

{{slot:toc}}

---

## What is Loop?

`Loop` is the Forge equivalent of Nunjucks' `loop` object. It only has
meaning inside an iterator. Use it when a template needs to know where
it is in a collection, whether the current item is first or last, or
how many items the iterator is processing.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};

Loop.index()
Loop.index0()
Loop.first()
Loop.last()
```

---

## How it works

Inside an `.each()` call, Forge tracks a loop frame for the current
iterator. `Loop` reads from that loop frame. It does not read from the
current item, and loop metadata is not added to the item value.

That separation means `item().value()` still returns the raw item,
while `Loop.index0()` returns the current zero-based position:

```rust
data("tags").each(iterator::map(obj! {
    "value": item().value(),
    "index": Loop.index0(),
}))
```

Loop metadata counts the items the iterator actually processes. When
an iterable omits nullish entries, `Loop.last()` is true for the final
item that is rendered or evaluated.

---

## Using in your definitions

### Dynamic field codes

Use `Loop.index0()` when you need stable zero-based suffixes for field
codes, button values, or item-specific URLs:

```rust
govuk::TEXT_INPUT.build(obj! {
    "code": format("memberName_%1", [Loop.index0().into()]),
    "label": obj! { "text": format("Member %1 name", [Loop.index().into()]) },
    "defaultValue": item().path("name"),
})
```

### Pagination and display positions

Use `Loop.index()` for user-facing numbers:

```rust
govuk::PAGINATION.build(obj! {
    "items": data("pages").each(iterator::map(obj! {
        "number": Loop.index(),
        "href": format("?page=%1", [Loop.index().into()]),
        "current": Loop.index().matches(condition::equals(data("currentPage"))),
    })),
})
```

### First, last, and reverse indexes

The edge metadata is useful when the first or last item needs special
display state:

```rust
iterator::map(obj! {
    "text": item().path("name"),
    "first": Loop.first(),
    "last": Loop.last(),
    "positionFromEnd": Loop.revindex(),
    "zeroBasedPositionFromEnd": Loop.revindex0(),
    "total": Loop.length(),
})
```

### Nested iteration

Inside a nested iterator, `Loop` refers to the innermost iterator.
Use `Loop.parent()` to reach the outer loop:

```rust
data("teams").each(iterator::map(obj! {
    "teamNumber": Loop.index(),
    "members": item().path("members").each(iterator::map(obj! {
        "memberNumber": Loop.index(),
        "teamNumber": Loop.parent().index(),
        "code": format("team_%1_member_%2", [Loop.parent().index0().into(), Loop.index0().into()]),
    })),
}))
```

You can chain `Parent` for deeper nesting:

```rust
Loop.parent().index0()
```

---

## API surface

`Loop` is exported directly. It is not called as a function:

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
```

| Method | Meaning |
|---|---|
| `Loop.index()` | One-based position of the current item |
| `Loop.index0()` | Zero-based position of the current item |
| `Loop.revindex()` | One-based position from the end of the collection |
| `Loop.revindex0()` | Zero-based position from the end of the collection |
| `Loop.first()` | `true` for the first processed item |
| `Loop.last()` | `true` for the last processed item |
| `Loop.length()` | Number of items processed by the iterator |
| `Loop.parent()` | Metadata for the parent iterator in nested loops |

---

## Best practices

- **Use `Loop.index0()` for dynamic field codes.** Field codes often
  need zero-based indexes to line up with arrays in answers or data.
- **Use `Loop.index()` for user-facing numbers.** Users expect lists
  and pagination to start at 1, not 0.
- **Keep item data and loop metadata separate.** Use `item()` for
  properties on the current item and `Loop` for iterator metadata.
- **Avoid deep loop nesting.** If a block needs metadata from multiple
  ancestor loops, consider shaping the data in an effect before
  rendering it. The same applies to deeply nested [item().parent()](item)
  data.
