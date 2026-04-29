---
title: Item (Iterators)
section: authoring-language
path: authoring-language/item
teaches: [Item, item-path, item-value, item-key, item-parent]
prerequisites: [Iterator, each, Iterator.Map, Iterator.Filter, Iterator.Find]
---

<p class="govuk-caption-xl">References</p>

# Item (Iterators)

`Item()` references the current item inside an `.each()` iteration.
Where `Answer()` references a field and `Data()` references step
data, `Item()` references whatever the iterator is currently
pointing at.

{{slot:toc}}

---

## What is Item?

When you iterate over a collection with `.each()`, you need a way
to refer to each item as the iteration processes it. `Item()` is
that reference. It only has meaning inside an iterator. Outside
one, it has nothing to resolve to.

```typescript
import { Item } from '@ministryofjustice/hmpps-forge/core/authoring'

Item().path('country')
```

---

## How it works

Inside an `.each()` call, `Item()` resolves to the current item on
each pass through the collection. If the collection is an array of
objects, `Item().path('name')` gives you the `name` property of
whichever object the iterator is currently on.

`Item()` is scoped to its iterator. In nested iterations,
`Item()` always refers to the innermost one. Use `Item().parent`
to reach the outer item.

Iterator metadata is separate from item data. `Item()` reads values
from the current item. Use [Loop](loop) when you need metadata about
the current iterator, such as the current position, whether the item
is first or last, or the total number of processed items.

---

## Using in your definitions

### Accessing item properties

Use `.path()` to navigate into the current item's properties:

```typescript
Answer('trips').each(
  Iterator.Map(
    GovUKSummaryList({
      card: {
        title: { text: Item().path('country') },
      },
      rows: [
        {
          key: { text: 'Departure date' },
          value: { text: Item().path('departureDate') },
        },
        {
          key: { text: 'Return date' },
          value: { text: Item().path('returnDate') },
        },
      ],
    }),
  ),
)
```

### Primitive collections

When the collection contains simple values rather than objects,
`Item().value()` gives you the raw value:

```typescript
Data('tags').each(
  Iterator.Map(
    GovUKTag({ text: Item().value() }),
  ),
)
```

### Nested iteration

When items themselves contain collections, you can nest `.each()`
calls. Inside the inner iterator, `Item()` refers to the inner
item. Use `Item().parent` to reach the outer scope:

```typescript
Data('teams').each(
  Iterator.Map({
    teamName: Item().path('name'),
    members: Item().path('members').each(
      Iterator.Map({
        memberName: Item().path('name'),
        team: Item().parent.path('name'),
      }),
    ),
  }),
)
```

Use [Loop.Parent](loop) when you need metadata from the outer
iterator.

---

## API surface

### `Item()`

Creates a reference to the current item in an `.each()` iteration.
Takes no arguments. Must be used inside an iterator.

```typescript
import { Item } from '@ministryofjustice/hmpps-forge/core/authoring'
```

Returns a scoped reference with the following methods:

### `.path(key)`

Navigates to a property within the current item. Supports dot
notation.

```typescript
Item().path('address.postcode')
```

### `.value()`

The current item's raw value. Useful when iterating over
primitives rather than objects.

### `.key()`

The current key when iterating over an object's entries rather
than an array.

### `.parent`

References the outer iterator's item in nested iterations. This is
lowercase because it belongs to `Item()`:

```typescript
Item().parent.path('teamName')
```

Use `Loop.Parent` when you need metadata from the outer iterator
instead.

## Best practices

- **Use `.path()` for object collections, `.value()` for
  primitives.** If each item is an object, navigate with `.path()`.
  If the collection is a flat array of strings or numbers, use
  `.value()`.
- **Keep item data and loop metadata separate.** Use `Item()` for
  properties on the current item and [Loop](loop) for iterator
  metadata such as indexes, first/last, and length.
- **Avoid deep item nesting.** If a block needs data from multiple
  ancestor items, consider shaping the data in an effect before
  passing it to the definition. The same applies to deeply nested
  [Loop.Parent](loop) metadata.
