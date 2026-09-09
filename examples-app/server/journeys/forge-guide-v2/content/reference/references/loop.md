---
title: Loop
slug: loop
section: reference
path: reference/loop
nav: Authoring API/References
order: 60
description: References the current item and position metadata inside an iterator
teaches: [loop, references, iteration, position, index, item]
prerequisites: [step]
related:
  reference: data, literal
---

# `Loop`

`Loop` references the current item and position metadata inside an [`.each()`](./iterator) iteration.
You use it to access each item's properties, read the current index, check whether the
item is first or last, or get the total count.

```typescript
import { Loop } from '@ministryofjustice/hmpps-forge/core/authoring'

// Read a property from the current item
Loop.Item().path('name')

// Use the whole item as a value
Loop.Item().value()

// 1-based position
Loop.Index()

// 0-based index (useful for building URLs)
Loop.Index0()

// Check whether this is the last item
Loop.Last()
```

`Loop` is an object with methods, not a function. You never write `Loop()` - you call
a specific method like `Loop.Item()`, `Loop.Index()`, or `Loop.First()`.

---

## Reference

### Methods

Each method returns a `ChainableRef` - the same immutable expression builder that
[`Answer()`](./answer) returns. All the same chainable methods are available: `.path()`,
`.pipe()`, `.match()`, `.not`, and `.each()`. See the
[Answer() methods documentation](./answer#methods) for details.

#### `Loop.Item()`

Returns a scoped reference to the current item in the iteration. You call one of its
methods to access the item's data.

```typescript
Loop.Item(): ChainableScopedRef
```

`Loop.Item()` has three methods:

- `.path(key)` - reads a property from the current item. Dot notation navigates into
  nested properties: `Loop.Item().path('address.postcode')`.
- `.value()` - returns the whole item as a value. Use this when the item is a primitive
  (a string or number) rather than an object with properties.
- `.key()` - returns the entry key when iterating an object rather than an array.

Each method returns a `ChainableRef`, so you can chain `.pipe()`, `.match()`, `.not`,
and `.each()` from there.

A bare `Loop.Item()` used as a value resolves to the whole item, just like `.value()`.
`Item()` remains an alias. Array items can be `null` or `undefined`; they still count
in `Loop.Length()` and retain their original positions.

In a nested iteration, `Loop.Parent.Item()` reaches the enclosing iterator's item.

#### `Loop.Index()`

The current position, 1-based. The first item is `1`, the second is `2`.

```typescript
Loop.Index(): ChainableRef
```

#### `Loop.Index0()`

The current position, 0-based. The first item is `0`, the second is `1`.

```typescript
Loop.Index0(): ChainableRef
```

#### `Loop.RevIndex()`

The reverse position, 1-based. The last item is `1`, the second-to-last is `2`.

```typescript
Loop.RevIndex(): ChainableRef
```

#### `Loop.RevIndex0()`

The reverse position, 0-based. The last item is `0`, the second-to-last is `1`.

```typescript
Loop.RevIndex0(): ChainableRef
```

#### `Loop.First()`

`true` when the current item is the first in the collection, `false` otherwise.

```typescript
Loop.First(): ChainableRef
```

#### `Loop.Last()`

`true` when the current item is the last in the collection, `false` otherwise.

```typescript
Loop.Last(): ChainableRef
```

#### `Loop.Length()`

The total number of items in the collection.

```typescript
Loop.Length(): ChainableRef
```

#### `Loop.Parent`

Returns a `Loop` reference scoped to the enclosing iterator in a nested iteration.
Each `.Parent` step moves one level outward:

```typescript
Loop.Parent.Index()
```

---

## Usage

### Use a 0-based index

`Loop.Index0()` gives each item a 0-based position:

```typescript
GovUKSummaryList({
  collection: Data('contacts').each(
    Iterator.Map({
      title: { text: Loop.Item().path('contactName') },
      actions: {
        items: [
          {
            href: Format('edit-contact/%1', Loop.Index0()),
            text: 'Edit',
          },
          {
            href: Format('delete-contact/%1', Loop.Index0()),
            text: 'Delete',
          },
        ],
      },
    })
  ),
})
```

### Iterate a list of strings

When the items are primitives, use `.value()` to get each one:

```typescript
Literal(['Apple', 'Banana', 'Cherry']).each(
  Iterator.Map({
    text: Loop.Item().value(),
  })
)
```

### Use a 1-based position number

```typescript
number: Loop.Index()
```

### Match the loop index against a value

Compare the current position against another value:

```typescript
Data('pages').each(
  Iterator.Map({
    number: Loop.Index(),
    href: Format('?page=%1', Loop.Index()),
    current: Loop.Index().match(Condition.Equals(Data('currentPage'))),
  })
)
```

### Show content only on the first or last item

```typescript
visibleWhen: Loop.First()
```

```typescript
visibleWhen: Loop.Last()
```

### Access the outer loop in nested iterations

In a nested `.each()`, use `Loop.Parent` to reference the enclosing iteration's
position and item:

```typescript
Data('groups').each(
  Iterator.Map({
    groupName: Loop.Item().path('name'),
    members: Loop.Item().path('members').each(
      Iterator.Map({
        memberName: Loop.Item().path('name'),
        groupName: Loop.Parent.Item().path('name'),
      })
    ),
  })
)
```

The inner `Loop.Item()` refers to the current member. `Loop.Parent.Item()` refers to
the current group.

---

## Troubleshooting

### Loop used outside an iterator

`Loop` methods must sit inside an `.each()` iterator body. Using them in a step-level
expression or a block outside an iteration produces a compile-time error. Move the
expression into the iterator's body.

### Loop.Parent exceeds nesting depth

Each `.Parent` step moves one iterator level outward. If you chain more `.Parent`
calls than the actual nesting depth, the error tells you how many levels exist.
Check that the expression sits inside enough nested `.each()` calls for the number
of `.Parent` steps.
