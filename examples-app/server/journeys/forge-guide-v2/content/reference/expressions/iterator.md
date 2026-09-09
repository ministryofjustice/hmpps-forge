---
title: Iterator
slug: iterator
section: reference
path: reference/iterator
nav: Authoring API/Expressions
order: 40
description: Creates map, filter, and find configurations for iterating collections
teaches: [iterator, expressions, iteration, map, filter, find]
prerequisites: [step]
related:
  reference: loop, data, literal
---

# `Iterator`

`Iterator` creates the configuration that `.each()` uses to process a collection. You
call one of its methods to map items into a new shape, filter items by a condition, or
find the first item that matches.

```typescript
import { Iterator } from '@ministryofjustice/hmpps-forge/core/authoring'

// Map each item into a component shape
Data('contacts').each(
  Iterator.Map({
    text: Loop.Item().path('name'),
  })
)

// Filter to active items only
Data('items').each(
  Iterator.Filter(
    Loop.Item().path('active').match(Condition.Equals(true))
  )
)

// Find the first matching item
Data('areas').each(
  Iterator.Find(
    Loop.Item().path('slug').match(Condition.Equals(Params('area')))
  )
)
```

`Iterator` is an object with methods, not a function. You never write `Iterator()` -
you call a specific method like `Iterator.Map()`, `Iterator.Filter()`, or
`Iterator.Find()`.

---

## Reference

### Methods

`Map` and `Filter` produce iterables - you can chain further `.each()` calls or exit
with `.pipe()` for whole-collection transforms. `Find` produces a single reference -
you navigate into the found item with `.path()`.

#### `Iterator.Map(yieldValue)`

Creates a map configuration that produces a new value from each item. The yield value
is a per-item expression that resolves once per item.

```typescript
Iterator.Map(yieldValue: unknown): MapIteratorConfig
```

:::param
---
name: yieldValue
type: "unknown"
required: true
---
The value to produce for each item. Accepts an object literal with
[`Loop.Item()`](./loop) references, an array of components, or a single
expression. Each `Loop.Item()` reference in the value resolves to the current item
during iteration.
:::

When `.each()` receives a `Map` configuration, it returns an iterable. You can chain
another `.each()` to map or filter further, or call `.pipe()` for a whole-collection
transform like [`Transformer.Array.Join()`](./transformer).

Every input item produces one output slot, including yields that resolve to `undefined`.
Pipe the result through `Transformer.Array.Compact()` to remove absent values.

#### `Iterator.Filter(predicate)`

Creates a filter configuration that keeps only items where a condition is true. The
original item passes through unchanged - no transformation happens.

```typescript
Iterator.Filter(predicate: PredicateExpr): FilterIteratorConfig
```

:::param
---
name: predicate
type: "PredicateExpr"
required: true
---
The condition to test each item against. This is what
`Loop.Item().path('x').match(...)` produces, or a combinator built with
[`and()`](./and), [`or()`](./or), [`not()`](./not), or [`xor()`](./xor).
:::

When `.each()` receives a `Filter` configuration, it returns an iterable. Chain a
`Map` after it to transform the items that survived the filter.

#### `Iterator.Find(predicate)`

Creates a find configuration that returns the first item where a condition is true.
The result is a single value, not an iterable.

```typescript
Iterator.Find(predicate: PredicateExpr): FindIteratorConfig
```

:::param
---
name: predicate
type: "PredicateExpr"
required: true
---
The condition to test each item against. Same type as `Filter`. The first item to
match is the result.
:::

When `.each()` receives a `Find` configuration, it returns a single reference instead
of an iterable. Call `.path()` to navigate into the found item. When no item matches,
the expression resolves to `undefined`.

#### Caveats

- Array inputs retain `null` and `undefined` items. Loop positions and length reflect
  the full input. Pipe the input through `Transformer.Array.Compact()` to remove them
  before iteration.

- `Filter` and `Find` on objects return `[key, value]` tuples, not values. When `.each()`
  receives an object, `Iterator.Map` gives you the value through `Loop.Item()`. But
  `Iterator.Filter` and `Iterator.Find` return the raw `Object.entries()` tuple. A
  downstream `.each()` on filtered object results iterates those tuples as array items.

- All iteration in a request shares a default budget of 10,000 iterations. This is a security
  limit to prevent memory exhaustion from a targeted attack. Chained `.each()` stages
  multiply consumption. Exceeding the budget throws `ForgeIteratorBudgetExceededError`.
  You can change the limit through `maxIteratorIterations` in the Forge config.

---

## Usage

### Map data into component properties

The most common use - turn each item in a collection into a structure that a component
consumes:

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

### Filter then map

Chain a filter before a map to transform only the items you want:

```typescript
Data('items')
  .each(Iterator.Filter(
    Loop.Item().path('active').match(Condition.Equals(true))
  ))
  .each(Iterator.Map({
    label: Loop.Item().path('name'),
    value: Loop.Item().path('id'),
  }))
```

The filter runs first and keeps active items. The map then transforms each surviving
item into a `{ label, value }` pair.

### Find a single item and read its properties

`Find` returns a single reference. Chain `.path()` to read a property from the found
item:

```typescript
Literal(areasOfNeed)
  .each(Iterator.Find(
    Loop.Item().path('slug').match(Condition.Equals(Params('area')))
  ))
  .path('goals')
```

This finds the area whose slug matches the route parameter, then reads its `goals`
property.

### Include loop position in mapped values

Use [`Loop.Index()`](./loop) or `Loop.Index0()` inside a map to include the item's position:

```typescript
collection: Data('members').each(
  Iterator.Map([
    GovUKTextInput({
      code: Format('memberName_%1', Loop.Index0()),
      label: Format('Member %1 name', Loop.Index()),
    }),
  ])
)
```

### Exit iteration with a whole-collection transform

After a map, use `.pipe()` to transform the resulting collection as a whole:

```typescript
Data('tags')
  .each(Iterator.Map(Loop.Item().path('label')))
  .pipe(Transformer.Array.Join(', '))
```

This maps each item to its label, then joins all labels into a single string.

---

## Troubleshooting

### Map vs Filter vs Find return types

`Map` and `Filter` return an iterable - you can chain further `.each()` calls or exit
with `.pipe()`. `Find` returns a single reference - you navigate into it with `.path()`.

If you try to chain `.each()` after a `Find`, the types will not allow it. `Find`
produces one item, not a collection.

### A Map result contains undefined values

A missing property in the yield expression produces an `undefined` slot. `Map` preserves
that slot, so its output has the same length as its input. Check the property path, or
pipe the result through `Transformer.Array.Compact()` when absent values must be removed.

### Iterating an object instead of an array

`.each()` also accepts objects as input. Each entry becomes an item with the object key
available through `Loop.Item().key()` and properties available through
`Loop.Item().path()`. Scalar values are available through `Loop.Item().value()`.
