---
title: Loop (Iterators)
section: authoring-language
path: authoring-language/loop
teaches: [Loop, loop-index, loop-index0, loop-revindex, loop-first, loop-last, loop-length, loop-parent]
prerequisites: [Iterator, each, Iterator.Map, Item]
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

```typescript
import { Loop } from '@ministryofjustice/hmpps-forge/core/authoring'

Loop.Index()
Loop.Index0()
Loop.First()
Loop.Last()
```

---

## How it works

Inside an `.each()` call, Forge tracks a loop frame for the current
iterator. `Loop` reads from that loop frame. It does not read from the
current item, and loop metadata is not added to the item value.

That separation means `Item().value()` still returns the raw item,
while `Loop.Index0()` returns the current zero-based position:

```typescript
Data('tags').each(
  Iterator.Map({
    value: Item().value(),
    index: Loop.Index0(),
  }),
)
```

Loop metadata counts the items the iterator actually processes. When
an iterable omits nullish entries, `Loop.Last()` is true for the final
item that is rendered or evaluated.

---

## Using in your definitions

### Dynamic field codes

Use `Loop.Index0()` when you need stable zero-based suffixes for field
codes, button values, or item-specific URLs:

```typescript
GovUKTextInput({
  code: Format('memberName_%1', Loop.Index0()),
  label: { text: Format('Member %1 name', Loop.Index()) },
  defaultValue: Item().path('name'),
})
```

### Pagination and display positions

Use `Loop.Index()` for user-facing numbers:

```typescript
GovUKPagination({
  items: Data('pages').each(
    Iterator.Map({
      number: Loop.Index(),
      href: Format('?page=%1', Loop.Index()),
      current: Loop.Index().match(Condition.Equals(Data('currentPage'))),
    }),
  ),
})
```

### First, last, and reverse indexes

The edge metadata is useful when the first or last item needs special
display state:

```typescript
Iterator.Map({
  text: Item().path('name'),
  first: Loop.First(),
  last: Loop.Last(),
  positionFromEnd: Loop.RevIndex(),
  zeroBasedPositionFromEnd: Loop.RevIndex0(),
  total: Loop.Length(),
})
```

### Nested iteration

Inside a nested iterator, `Loop` refers to the innermost iterator.
Use `Loop.Parent` to reach the outer loop:

```typescript
Data('teams').each(
  Iterator.Map({
    teamNumber: Loop.Index(),
    members: Item().path('members').each(
      Iterator.Map({
        memberNumber: Loop.Index(),
        teamNumber: Loop.Parent.Index(),
        code: Format('team_%1_member_%2', Loop.Parent.Index0(), Loop.Index0()),
      }),
    ),
  }),
)
```

You can chain `Parent` for deeper nesting:

```typescript
Loop.Parent.Parent.Index0()
```

---

## API surface

`Loop` is exported directly. It is not called as a function:

```typescript
import { Loop } from '@ministryofjustice/hmpps-forge/core/authoring'
```

| Method | Meaning |
|---|---|
| `Loop.Index()` | One-based position of the current item |
| `Loop.Index0()` | Zero-based position of the current item |
| `Loop.RevIndex()` | One-based position from the end of the collection |
| `Loop.RevIndex0()` | Zero-based position from the end of the collection |
| `Loop.First()` | `true` for the first processed item |
| `Loop.Last()` | `true` for the last processed item |
| `Loop.Length()` | Number of items processed by the iterator |
| `Loop.Parent` | Metadata for the parent iterator in nested loops |

---

## Best practices

- **Use `Loop.Index0()` for dynamic field codes.** Field codes often
  need zero-based indexes to line up with arrays in answers or data.
- **Use `Loop.Index()` for user-facing numbers.** Users expect lists
  and pagination to start at 1, not 0.
- **Keep item data and loop metadata separate.** Use `Item()` for
  properties on the current item and `Loop` for iterator metadata.
- **Avoid deep loop nesting.** If a block needs metadata from multiple
  ancestor loops, consider shaping the data in an effect before
  rendering it. The same applies to deeply nested [Item().parent](item)
  data.
