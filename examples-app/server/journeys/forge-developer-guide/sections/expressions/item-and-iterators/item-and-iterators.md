---
title: Iterators
section: authoring-language
path: authoring-language/iterators
teaches: [Iterator, Iterator.Map, Iterator.Filter, Iterator.Find, each, CollectionBlock, Loop]
prerequisites: [Item, Answer, Data]
---

<p class="govuk-caption-xl">Expressions</p>

# Iterators

Iterators let you transform, filter, and search collections
declaratively. You apply them with `.each()` on any reference that
resolves to an array, and use `Item()` inside them to access each
element. Use `Loop` inside the same iterator when you need metadata
about the iteration itself, such as the current index or whether the
current item is first or last.

{{slot:toc}}

---

## What are iterators?

An iterator defines what to do with each item in a collection.
There are three types:

- **`Iterator.Map`** transforms each item into a new shape
- **`Iterator.Filter`** keeps items that match a condition
- **`Iterator.Find`** returns the first item that matches a condition

You apply an iterator to a collection using `.each()`:

```typescript
import { Iterator, Item } from '@ministryofjustice/hmpps-forge/core/authoring'

Data('countries').each(
  Iterator.Map({
    value: Item().path('code'),
    text: Item().path('name'),
  }),
)
```

---

## How it works

`.each()` walks through the collection and evaluates the iterator
for every item. The result depends on the iterator type:

- `Iterator.Map` produces a new array with the transformed items
- `Iterator.Filter` produces a new array with only the matching items
- `Iterator.Find` produces a single item (or `undefined` if none match)

Map and Filter return a chainable iterable, so you can chain
further `.each()` calls. Find returns a chainable reference, so
you can navigate the result with `.path()`.

---

## Using in your definitions

### Iterator.Map

Map transforms each item into a new shape. The template can be a
plain object, a block definition, or any value containing
[Item()](item) or [Loop](loop) references.

Building select items from data:

```typescript
GovUKSelectInput({
  code: 'appointmentTime',
  label: { text: 'Choose a time' },
  items: Data('availableSlots').each(
    Iterator.Map({
      value: Item().path('time'),
      text: Item().path('time'),
    }),
  ),
})
```

### Loop metadata

`Item()` represents the current item. [Loop](loop) represents
metadata about the current iterator:

```typescript
import { Iterator, Item, Loop, Format } from '@ministryofjustice/hmpps-forge/core/authoring'

Data('members').each(
  Iterator.Map({
    code: Format('memberName_%1', Loop.Index0()),
    label: Format('Member %1 of %2', Loop.Index(), Loop.Length()),
    name: Item().path('name'),
    first: Loop.First(),
    last: Loop.Last(),
  }),
)
```

`Loop.Index()` is one-based. `Loop.Index0()` is zero-based and is
usually the right choice for dynamic field codes. In nested iterators,
use `Loop.Parent.Index()` or `Loop.Parent.Index0()` to read metadata
from the outer loop.

Rendering a collection of summary cards:

```typescript
CollectionBlock({
  collection: Answer('trips').each(
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
  ),
  fallback: [GovUKInsetText({ text: 'You have not added any trips yet.' })],
})
```

`CollectionBlock` is one way to render the mapped output, with a
`fallback` for empty collections. But any component can be built to
accept and render arrays of blocks. `CollectionBlock` is just a
convenience provided by Forge's core components.

### Iterator.Filter

Filter keeps items that match a predicate:

```typescript
const activeGoals = Data('goals').each(
  Iterator.Filter(
    Item().path('status').match(Condition.Equals('ACTIVE')),
  ),
)
```

### Iterator.Find

Find returns the first matching item. The result is a reference
you can navigate with `.path()`:

```typescript
Data('users')
  .each(Iterator.Find(
    Item().path('id').match(Condition.Equals(Params('userId'))),
  ))
  .path('name')
```

If no item matches, the result is `undefined`.

### Chaining iterators

Because Map and Filter return chainable iterables, you can chain
multiple operations. Filter then map to avoid transforming items
that will be discarded:

```typescript
Data('goals')
  .each(Iterator.Filter(
    Item().path('status').match(Condition.Equals('ACTIVE')),
  ))
  .each(Iterator.Map(
    goalSummaryCard,
  ))
```

You can also get the length of a filtered collection by piping the
result:

```typescript
const activeGoalCount = Data('goals')
  .each(Iterator.Filter(
    Item().path('status').match(Condition.Equals('ACTIVE')),
  ))
  .pipe(Transformer.Array.Length())
```

---

## API surface

### `Iterator.Map(template)`

Transforms each item into the shape defined by `template`. The
template can be any value containing `Item()` references.

### `Iterator.Filter(predicate)`

Keeps items where the predicate evaluates to `true`. The predicate
is typically an `Item().path().match()` expression.

### `Iterator.Find(predicate)`

Returns the first item where the predicate evaluates to `true`, or
`undefined` if none match.

### `.each(iterator)`

Applies an iterator to a collection. Available on any reference
that resolves to an array. Map and Filter return a chainable
iterable. Find returns a chainable reference.

---

## Best practices

- **Use `CollectionBlock` for rendering mapped collections.** It
  handles rendering the array of blocks and provides a `fallback`
  for empty collections.
- **Filter before mapping when you need both.** Avoid transforming
  items that will be discarded.
- **Use Find for single-item lookups.** When you need one item from
  a collection by ID or key, Find is cleaner than filtering then
  taking the first element.
