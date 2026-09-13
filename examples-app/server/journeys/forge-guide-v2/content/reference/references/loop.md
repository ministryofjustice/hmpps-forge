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

### References

These methods select the current item or position within an iteration. Chain the
methods below to navigate, transform, or test the selected value.

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

Each method returns a `ChainableRef`, so you can chain `.pipe()`, `.nullish()`, `.match()`,
`.not`, and `.each()` from there.

A bare `Loop.Item()` used as a value resolves to the whole item, just like `.value()`.
Array items can be `null` or `undefined`; they still count
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

### Methods

Keep loop references inside the iterator that supplies their item or position.
The same chaining methods apply to references selected through `Loop.Parent`.

#### `.path(key)`

Navigates deeper into the referenced value.

```typescript
path(key: string): ChainableRef
```

:::param
---
name: key
type: "string"
required: true
---
The property to read from the resolved value. Dot notation navigates through
nested properties. A missing intermediate value resolves to `undefined` rather
than throwing an error.
:::

```typescript
Loop.Item().path('name')
```

Use `.path()` after another operation when you need to read a property from its
result.

#### `.pipe(...steps)`

Passes the referenced value through one or more [transformers](./transformer) in sequence.

```typescript
pipe(...steps: TransformerFunctionExpr[]): ChainableExpr
```

:::param
---
name: steps
type: "TransformerFunctionExpr[]"
required: false
---
The transformers to apply, passed as separate arguments in execution order. Each
transformer receives the previous step's output. With no arguments, the expression
keeps its value.
:::

Pass multiple transformers to apply them in sequence:

```typescript
Loop.Item().path('name').pipe(
  Transformer.String.Trim(),
  Transformer.String.ToLowerCase(),
)
```

When the value is absent, the pipeline is skipped and the expression stays absent.
The pipeline produces a value for this expression without changing the source value.

The returned expression continues the chain with `.path()`, `.pipe()`, `.nullish()`,
`.match()`, or `.each()`. Use `.not.match()` to negate a condition on its result.

#### `.nullish(fallback)`

Uses a fallback when the referenced value resolves to `null` or `undefined`.

```typescript
nullish(fallback: ResolvableValue | undefined): ChainableExpr
```

:::param
---
name: fallback
type: "ResolvableValue | undefined"
required: true
---
The value to use when the input resolves to `null` or `undefined`. Accepts a literal,
another reference, a generator call, or another value expression. Passing `undefined`
leaves a missing result absent.
:::

The fallback can be a fixed value or another expression:

```typescript
Loop.Item().path('name').nullish('Not provided')
```

Forge evaluates the input once and evaluates the fallback only when the input is
`null` or `undefined`.

Empty strings, `false`, `0`, empty arrays, and empty objects keep their original value.
The returned expression continues the chain with `.path()`, `.pipe()`, `.match()`,
`.each()`, or another `.nullish()`. It does not change the source value.

`.nullish()` does not catch errors. If the input throws, that error propagates without
running the fallback. References in the fallback still follow their normal scope rules;
for example, `Loop.Item()` needs an enclosing iterator.

#### `.match(condition)`

Tests the referenced value against a [condition](./condition). Returns an expression
that resolves to a boolean and can be used wherever a resolvable value is accepted.

```typescript
match(condition: ConditionFunctionExpr): PredicateTestExpr
```

:::param
---
name: condition
type: "ConditionFunctionExpr"
required: true
---
The condition to test against the resolved value. Pass a built-in condition such as
`Condition.IsRequired()`, or a custom condition entry. The resolved value becomes
the condition's `value` argument.
:::

For example, test whether the value is present:

```typescript
Loop.Item().path('name').match(Condition.IsRequired())
```

Use the result in `when`, `validWhen`, `visibleWhen`, or anywhere else that a
boolean/predicate is accepted.

#### `.not`

Negates the next `.match()`. This is a property, not a method - no parentheses needed.

```typescript
readonly not: ChainableNegation
```

`.not` takes no parameters.

```typescript
Loop.Item().path('name').not.match(Condition.Equals(''))
```

After `.not`, only `.match()` and another `.not` are available. You cannot `.pipe()` or
`.path()` after negation. `.not.not` cancels itself out.

#### `.each(iterator)`

Iterates over the referenced value when it contains an array or collection.

```typescript
each(iterator: MapIteratorConfig | FilterIteratorConfig): ChainableIterable
each(iterator: FindIteratorConfig): ChainableExpr
each(iterator: SomeIteratorConfig | EveryIteratorConfig): CollectionPredicateExpr
each(iterator: CountIteratorConfig): ChainableExpr
```

:::param
---
name: iterator
type: "IteratorConfig"
required: true
---
The per-item operation to perform. Create it with `Iterator.Map()`,
`Iterator.Filter()`, `Iterator.Find()`, `Iterator.Some()`, `Iterator.Every()`, or
`Iterator.Count()`. Item references and predicates resolve within that iteration.
:::

The iterator determines the result: an iterable (`Map` and `Filter`), a single value
(`Find`), a predicate (`Some` and `Every`), or a chainable number (`Count`).

See [`Iterator`](./iterator) for configuration and usage.

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

### Use a fallback for an absent value

Use `.nullish()` to supply a fallback when the reference resolves to `null` or
`undefined`:

```typescript
Data('contacts').each(Iterator.Map(
  Loop.Item().path('name').nullish('Unnamed contact')
))
```

This supplies a name separately for each contact whose name is absent. The
`Loop.Item()` reference stays inside the iterator that gives it its value.

Empty strings, `false`, and `0` keep their original value. Forge evaluates the fallback
only when the input is absent. You can also pass another reference or expression as
the fallback.

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
