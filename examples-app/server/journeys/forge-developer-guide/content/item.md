---
title: Item
section: authoring-language
path: authoring-language/item
teaches: [Item, item-path, item-index, item-value, item-key, item-parent]
prerequisites: [Iterator, each, Iterator.Map, Iterator.Filter, Iterator.Find]
---

<p class="govuk-caption-xl">References</p>

# Item

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
Item().index()
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

### Using the index

`Item().index()` gives the zero-based position of the current item.
This is useful for building dynamic field codes, URLs, and button
values:

```typescript
// Dynamic field codes for each item
GovUKSelectInput({
  code: Format('step_actor_%1', Item().index()),
  defaultValue: Item().path('actor'),
})

// Remove button with encoded index
GovUKButton({
  text: 'Remove',
  name: 'action',
  value: Format('remove_%1', Item().index()),
})
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

### `.index()`

The zero-based position of the current item in the collection.

### `.value()`

The current item's raw value. Useful when iterating over
primitives rather than objects.

### `.key()`

The current key when iterating over an object's entries rather
than an array.

### `.parent`

References the parent scope's item in nested iterations. Returns
another scoped reference with the same methods.

---

## Best practices

- **Use `.path()` for object collections, `.value()` for
  primitives.** If each item is an object, navigate with `.path()`.
  If the collection is a flat array of strings or numbers, use
  `.value()`.
- **Use `Item().index()` for dynamic field codes.** When a form
  needs a field per item, `Format('field_%1', Item().index())`
  produces unique codes for each.
- **Avoid deep nesting.** If you find yourself reaching for
  `Item().parent.parent`, consider restructuring the data in an
  effect before passing it to the definition.
