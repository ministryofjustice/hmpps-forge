---
title: Validating collections with iterators
section: patterns
path: patterns/collection-validation
teaches: [collection-validation, iterator-validation, per-item-errors]
prerequisites: [validation, iterator, data-reference]
---

<p class="govuk-caption-xl">Patterns</p>

# Validating collections with iterators
Validate that every item in a collection meets a set of rules before the
user can proceed. When items fail, each one produces its own error
message, so the user knows exactly which items to fix.

<p class="govuk-body"><a class="govuk-button" href="/forge-developer-guide/patterns/demos/collection-validation" data-module="govuk-button">Try the live demo</a></p>

{{slot:toc}}

---

## When to use it

Reach for this pattern when your validation logic needs to operate
over a collection — checking each item against a rule and surfacing
a targeted error message per failing item. The collection might come
from an API, from session state, from another step's answers, or from
any other source that produces an array.

It fits well when:

- Validation depends on properties of individual items inside a
  collection, not just a single field value.
- A single top-level message ("something is wrong") is not enough;
  the user needs to know **which items** are the problem.
- The rules are per-item: each item is checked independently and
  produces its own error message, optionally interpolating item
  properties like a title or name.

It does not fit when the rules only need to check simple scalar
values. In that case, a plain `validation()` with `Self()` or
`Answer()` is simpler and more direct.

---

## What the pattern covers

The live demo loads a list of sentence plan goals from the session,
seeding a default set on first visit.
Submitting the "agree plan" page runs two layers of validation:

- **Aggregate check** — at least one goal must have an `ACTIVE`
  status. This uses a filter-then-count chain as the condition inside
  a `validation()`.
- **Per-item check** — every active goal must have at least one action
  assigned. This uses `Iterator.Map()` to produce a separate
  `validation()` per goal, each with a message that includes the
  goal's title.

Both sit in the same `validWhen` array on the radio field, alongside a
standard `Self()` required rule.

---

## How it works

### An iterator chain as a validation condition

Filter the collection down to the items you care about, transform the
result, and match against a threshold:

```typescript
validation({
  condition: Data('goals')
    .each(Iterator.Filter(
      Item().path('status').match(Condition.Equals('ACTIVE')),
    ))
    .pipe(Transformer.Array.Length())
    .match(Condition.Number.GreaterThan(0)),
  message: 'To agree the plan, create a goal to work on now',
})
```

This reads as: *filter goals to those whose status is ACTIVE, count
them, and check the count is greater than zero*. The entire chain is
the `condition` of a single `validation()`.

### An iterate that yields per-item validations

When you need a separate error message per failing item, place an
iterate expression directly in the `validWhen` array instead of
wrapping it in `validation()`:

```typescript
Data('goals')
  .each(Iterator.Filter(
    Item().path('status').match(Condition.Equals('ACTIVE')),
  ))
  .each(
    Iterator.Map(
      validation({
        condition: Item()
          .path('actions')
          .pipe(Transformer.Array.Length())
          .match(Condition.Number.GreaterThan(0)),
        message: Format("Add actions to '%1'", Item().path('title')),
      }),
    ),
  ),
```

This reads as: *filter to active goals, then for each one emit a
validation that checks its actions array is non-empty*. The `Format()`
call interpolates the goal's title into the error message, so the user
sees something like *"Add actions to 'Find stable housing'"*.

### Mixing the two styles

Both the aggregate validation and the per-item iterate sit in the same
`validWhen` array alongside a standard `Self()` required rule:

```typescript
validWhen: [
  validation({ condition: Self().match(Condition.IsRequired()), ... }),
  validation({ condition: Data('goals').each(...).pipe(...).match(...), ... }),
  Data('goals').each(...).each(Iterator.Map(validation({ ... }))),
]
```

Forge evaluates every entry. A `validation()` that fails adds one
error; an iterate that yields failing validations adds one error per
failing item. They all appear together in the error summary.

---

## Variations

- **Multiple rules per item.** The `Iterator.Map()` yield can be an
  array of `validation()` expressions rather than a single one. Each
  item then produces multiple possible errors.
- **Nested filters.** Chain `.each(Iterator.Filter(...))` calls to
  narrow by multiple criteria before mapping to validations.
- **Step-level validWhen.** The iterate can go on a step's `validWhen`
  instead of a field's. Use this when the errors are about the
  overall step rather than a specific input.
