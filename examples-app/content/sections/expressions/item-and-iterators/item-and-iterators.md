---
title: Iterators
section: authoring-language
path: authoring-language/iterators
teaches: [iterator, iterator::map, iterator::filter, iterator::find, each, core_blocks::COLLECTION_BLOCK, Loop]
prerequisites: [item, answer, data]
---

<p class="govuk-caption-xl">Expressions</p>

# Iterators

Iterators let you transform, filter, and search collections
declaratively. You apply them with `.each()` on any reference that
resolves to an array, and use `item()` inside them to access each
element. Use `Loop` inside the same iterator when you need metadata
about the iteration itself, such as the current index or whether the
current item is first or last.

{{slot:toc}}

---

## What are iterators?

An iterator defines what to do with each item in a collection.
There are three types:

- **`iterator::map`** transforms each item into a new shape
- **`iterator::filter`** keeps items that match a condition
- **`iterator::find`** returns the first item that matches a condition

You apply an iterator to a collection using `.each()`:

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};

data("countries").each(iterator::map(obj! {
    "value": item().path("code"),
    "text": item().path("name"),
}))
```

---

## How it works

`.each()` walks through the collection and evaluates the iterator
for every item. The result depends on the iterator type:

- `iterator::map` produces a new array with the transformed items
- `iterator::filter` produces a new array with only the matching items
- `iterator::find` produces a single item (or `undefined` if none match)

Map and Filter return a chainable iterable, so you can chain
further `.each()` calls. Find returns a chainable reference, so
you can navigate the result with `.path()`.

---

## Using in your definitions

### iterator::map

Map transforms each item into a new shape. The template can be a
plain object, a block definition, or any value containing
[item()](item) or [Loop](loop) references.

Building select items from data:

```rust
govuk::SELECT_INPUT.build(obj! {
    "code": "appointmentTime",
    "label": obj! { "text": "Choose a time" },
    "items": data("availableSlots").each(iterator::map(obj! {
        "value": item().path("time"),
        "text": item().path("time"),
    })),
})
```

### Loop metadata

`item()` represents the current item. [Loop](loop) represents
metadata about the current iterator:

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};

data("members").each(iterator::map(obj! {
    "code": format("memberName_%1", [Loop.index0().into()]),
    "label": format("Member %1 of %2", [Loop.index().into(), Loop.length().into()]),
    "name": item().path("name"),
    "first": Loop.first(),
    "last": Loop.last(),
}))
```

`Loop.index()` is one-based. `Loop.index0()` is zero-based and is
usually the right choice for dynamic field codes. In nested iterators,
use `Loop.parent().index()` or `Loop.parent().index0()` to read metadata
from the outer loop.

Rendering a collection of summary cards:

```rust
core_blocks::COLLECTION_BLOCK.build(obj! {
    "collection": answer("trips").each(iterator::map(govuk::SUMMARY_LIST.build(obj! {
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
    }))),
    "fallback": [govuk::INSET_TEXT.build(obj! { "text": "You have not added any trips yet." })],
})
```

`core_blocks::COLLECTION_BLOCK` is one way to render the mapped output, with a
`fallback` for empty collections. But any component can be built to
accept and render arrays of blocks. `core_blocks::COLLECTION_BLOCK` is just a
convenience provided by Forge's core components.

### iterator::filter

Filter keeps items that match a predicate:

```rust
let active_goals = data("goals").each(iterator::filter(item().path("status").matches(condition::equals("ACTIVE"))));
```

### iterator::find

Find returns the first matching item. The result is a reference
you can navigate with `.path()`:

```rust
data("users").each(iterator::find(item().path("id").matches(condition::equals(params("userId"))))).path("name")
```

If no item matches, the result is `undefined`.

### Chaining iterators

Because Map and Filter return chainable iterables, you can chain
multiple operations. Filter then map to avoid transforming items
that will be discarded:

```rust
data("goals").each(iterator::filter(item().path("status").matches(condition::equals("ACTIVE")))).each(iterator::map(goal_summary_card))
```

You can also get the length of a filtered collection by piping the
result:

```rust
let active_goal_count = data("goals").each(iterator::filter(item().path("status").matches(condition::equals("ACTIVE")))).pipe([transformer::array::length()]);
```

---

## API surface

### `iterator::map(template)`

Transforms each item into the shape defined by `template`. The
template can be any value containing `item()` references.

### `iterator::filter(predicate)`

Keeps items where the predicate evaluates to `true`. The predicate
is typically an `item().path().matches()` expression.

### `iterator::find(predicate)`

Returns the first item where the predicate evaluates to `true`, or
`undefined` if none match.

### `.each(iterator)`

Applies an iterator to a collection. Available on any reference
that resolves to an array. Map and Filter return a chainable
iterable. Find returns a chainable reference.

---

## Best practices

- **Use `core_blocks::COLLECTION_BLOCK` for rendering mapped collections.** It
  handles rendering the array of blocks and provides a `fallback`
  for empty collections.
- **Filter before mapping when you need both.** Avoid transforming
  items that will be discarded.
- **Use Find for single-item lookups.** When you need one item from
  a collection by ID or key, Find is cleaner than filtering then
  taking the first element.
