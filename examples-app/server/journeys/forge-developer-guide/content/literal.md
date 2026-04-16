---
title: Literal
section: authoring-language
path: authoring-language/literal
teaches: [Literal, static-values, chainable-static]
prerequisites: [each, Iterator, pipe]
---

<p class="govuk-caption-xl">Expressions</p>

# Literal

`Literal()` wraps a static value so it can be used where Forge
expects an expression. It's the bridge between plain JavaScript
values and Forge's expression system.

{{slot:toc}}

---

## What is Literal?

References like `Answer()` and `Data()` resolve values at runtime.
But sometimes you already have the value and need to use it with
expression features like `.each()`, `.match()`, or `.pipe()`.
`Literal()` wraps a static value so Forge treats it as an
expression.

```typescript
import { Literal } from '@ministryofjustice/hmpps-forge/core/authoring'

Literal(['apple', 'banana', 'cherry'])
```

The most common use is making a static array iterable. `Data()`
and `Answer()` references are already expressions, so they work
with `.each()` directly. But a plain JavaScript array is not an
expression, so it needs `Literal()` first.

---

## Using in your definitions

### Iterating over static arrays

When the data lives in your code rather than in step data or an
effect, wrap it with `Literal()` to iterate over it:

```typescript
const areasOfNeed = [
  { value: 'accommodation', text: 'Accommodation' },
  { value: 'education', text: 'Education, training and employment' },
  { value: 'finance', text: 'Finance' },
  { value: 'health', text: 'Health and wellbeing' },
]

GovUKCheckboxInput({
  code: 'selectedAreas',
  fieldset: { legend: { text: 'Select areas of need' } },
  items: Literal(areasOfNeed).each(
    Iterator.Map({
      value: Item().path('value'),
      text: Item().path('text'),
    }),
  ),
})
```

Without `Literal()`, you could achieve the same by putting the
array in the step's `data` property and using `Data('areasOfNeed')`.
`Literal()` is a shortcut when the data is small and co-located
with the block that uses it.

### Static collections in CollectionBlock

`Literal()` works the same way with `CollectionBlock`:

```typescript
CollectionBlock({
  collection: Literal(tableRows).each(
    Iterator.Map(myRowComponent),
  ),
})
```

### Using with conditions

You can also use `Literal()` to test a static value against a
condition:

```typescript
Literal(items)
  .pipe(Transformer.Array.Length())
  .match(Condition.Number.GreaterThan(0))
```

---

## API surface

### `Literal(value)`

Wraps a static value as an expression.

```typescript
import { Literal } from '@ministryofjustice/hmpps-forge/core/authoring'
```

`value` can be any serialisable value: a string, number, boolean,
array, or plain object.

Returns a chainable expression that supports `.path()`, `.match()`,
`.pipe()`, and `.each()`.

---

## Best practices

- **Prefer `data` or `Data()` for most static values.** If the
  value is used across multiple blocks or steps, the step or journey's `data`
  property is a better home. `Literal()` is best for small,
  one-off values co-located with the block that uses them.
- **Keep literal values serialisable.** Forge definitions must be
  serialisable. Functions, class instances, and circular references
  inside a `Literal()` will fail validation at startup.
