---
title: Iterator
slug: iterator
section: reference
path: reference/iterator
nav: Authoring API/Expressions
order: 40
description: Creates configurations to map, filter, find, test, and count collection items
teaches: [iterator, expressions, iteration, map, filter, find, some, every, count]
prerequisites: [step]
related:
  reference: loop, data, literal, and, not, validation
---

# `Iterator`

`Iterator` creates the configuration that `.each()` uses to process a collection. You
call one of its methods to map items into a new shape, filter items by a condition, or
find the first item that matches. You can also test whether any or every item matches,
or count the matching items.

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
`Iterator.Find()`. The same pattern applies to `Iterator.Some()`, `Iterator.Every()`,
and `Iterator.Count()`.

---

## Reference

### Methods

`Map` and `Filter` produce iterables - you can chain further `.each()` calls or exit
with `.pipe()` for whole-collection transforms. `Find` produces a single reference -
you navigate into the found item with `.path()`. `Some` and `Every` produce predicates
that you use directly in conditions. `Count` produces a chainable number.

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

#### `Iterator.Some(predicate)`

Creates a some configuration that tests whether at least one item matches a condition.
It stops at the first match.

```typescript
Iterator.Some(predicate: PredicateExpr): SomeIteratorConfig
```

:::param
---
name: predicate
type: "PredicateExpr"
required: true
---
The condition to test each item against. Same type as `Filter`. One matching item is
enough for the result to be `true`.
:::

When `.each()` receives a `Some` configuration, it returns a predicate. Use it directly
in `when`, `visibleWhen`, or a validation's `condition`, or combine it with [`and()`](./and)
and [`or()`](./or). When no items match, including an empty collection, it resolves to
`false`.

#### `Iterator.Every(predicate)`

Creates an every configuration that tests whether all items match a condition.
It stops at the first item that does not match.

```typescript
Iterator.Every(predicate: PredicateExpr): EveryIteratorConfig
```

:::param
---
name: predicate
type: "PredicateExpr"
required: true
---
The condition to test each item against. Same type as `Filter`. Each item must match
for the result to be `true`.
:::

When `.each()` receives an `Every` configuration, it returns a predicate. Use it in the
same places as `Some`. An empty collection resolves to `true`: there are no items
that fail the condition. Add a separate non-empty check when at least one item is
required.

#### `Iterator.Count(predicate)`

Creates a count configuration that counts how many items match a condition.
It visits every item in the collection.

```typescript
Iterator.Count(predicate: PredicateExpr): CountIteratorConfig
```

:::param
---
name: predicate
type: "PredicateExpr"
required: true
---
The condition to test each item against. Same type as `Filter`. Each matching item
adds one to the result. The predicate is required; `Iterator.Count()` without an
argument is not a count-all operation.
:::

When `.each()` receives a `Count` configuration, it returns a chainable number. Use
it as a value, transform it with `.pipe()`, or compare it with `.match()`. When no items
match, including an empty collection, it resolves to `0`.

#### Caveats

- `Some` and `Every` short-circuit. Later items and their predicate functions are not
  evaluated once the result is known. `Count` evaluates the predicate for every item.

- Missing collections (`null` or `undefined`) and scalar inputs are treated as empty.
  `Some` returns `false`, `Every` returns `true`, and `Count` returns `0`. These results
  do not establish that the input was a valid collection.

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
  rows: Data('contacts').each(
    Iterator.Map({
      key: { text: Loop.Item().path('contactName') },
      value: { text: Loop.Item().path('email') },
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

### Require at least one matching item

Use `Some` directly as a validation condition:

```typescript
validation({
  condition: Data('goals').each(Iterator.Some(
    Loop.Item().path('active').match(Condition.Equals(true))
  )),
  message: 'Add at least one active goal',
})
```

This fails for an empty list or a list containing only inactive goals. Once an active
goal is found, Forge does not test later goals.

### Require every item to be complete

Use `Every` when each item must satisfy the same rule:

```typescript
validation({
  condition: Data('tasks').each(Iterator.Every(
    Loop.Item().path('status').match(Condition.Equals('complete'))
  )),
  message: 'Complete every task',
})
```

An empty task list passes this rule. To require at least one task as well, combine the
predicate with a length check:

```typescript
and(
  Data('tasks').path('length').match(Condition.Number.GreaterThan(0)),
  Data('tasks').each(Iterator.Every(
    Loop.Item().path('status').match(Condition.Equals('complete'))
  )),
)
```

The length check here expects an array. `Every` itself also accepts keyed objects.

### Count matching items

Use `Count` when the result needs to be a number rather than a yes-or-no answer:

```typescript
const completedTaskCount = Data('tasks').each(Iterator.Count(
  Loop.Item().path('status').match(Condition.Equals('complete'))
))

GovUKHeading({
  text: Format('%1 tasks complete', completedTaskCount),
})
```

The count is a value expression, so it can also feed a condition:

```typescript
Data('tasks')
  .each(Iterator.Count(
    Loop.Item().path('status').match(Condition.Equals('complete'))
  ))
  .match(Condition.Number.GreaterThanOrEqual(3))
```

This checks whether at least three tasks are complete. If you only need to know
whether any task is complete, use `Some` so iteration can stop at the first match.

### Filter before testing a collection

Chain `Every` after a filter to test only the items that remain:

```typescript
Data('tasks')
  .each(Iterator.Filter(
    Loop.Item().path('required').match(Condition.Equals(true))
  ))
  .each(Iterator.Every(
    Loop.Item().path('status').match(Condition.Equals('complete'))
  ))
```

This checks whether all required tasks are complete. If the filter removes every
item, `Every` receives an empty collection and returns `true`. You can finish the
same filtered chain with `Some` or `Count` when you need a different result.

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

### Choosing an iterator by its result

The configuration passed to `.each()` determines the result and what can follow it:

| Iterator | Result | Continue with | Empty collection |
|---|---|---|---|
| `Map` | Iterable of mapped values | `.each()` or `.pipe()` | `[]` |
| `Filter` | Iterable of matching items | `.each()` or `.pipe()` | `[]` |
| `Find` | Chainable value for the first match | `.path()`, `.pipe()`, or `.nullish()` | `undefined` |
| `Some` | Predicate | Use directly or combine with `and()`, `or()`, or `not()` | `false` |
| `Every` | Predicate | Use directly or combine with `and()`, `or()`, or `not()` | `true` |
| `Count` | Chainable number | `.pipe()` or `.match()` | `0` |

`Find` returns an item, so another iteration only makes sense if that item, or a
property you read from it, is itself a collection. `Count` returns a number, not a
collection of matching items.

### Chaining .match() after Some or Every does not work

`Some` and `Every` already produce predicates. There is no `.match()` method on their
results. Use the predicate directly, or wrap it in [`not()`](./not) to negate it:

```typescript
not(Data('tasks').each(Iterator.Some(
  Loop.Item().path('status').match(Condition.Equals('complete'))
)))
```

### Every passes when the collection is missing or empty

`Every` checks for items that fail its condition. An empty input has none, so the
result is `true`. Check that the collection exists and contains items separately if
those are requirements. A prior filter can also leave an empty input even when the
original collection had items.

### A Map result contains undefined values

A missing property in the yield expression produces an `undefined` slot. `Map` preserves
that slot, so its output has the same length as its input. Check the property path, or
pipe the result through `Transformer.Array.Compact()` when absent values must be removed.

### Iterating an object instead of an array

`.each()` also accepts objects as input. Each entry becomes an item with the object key
available through `Loop.Item().key()` and properties available through
`Loop.Item().path()`. Scalar values are available through `Loop.Item().value()`.
