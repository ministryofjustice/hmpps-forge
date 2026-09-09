---
title: Working with repeated data
slug: working-with-repeated-data
section: concepts
path: concepts/working-with-repeated-data
nav: Answers and request state
order: 12
description:
  How Forge evaluates repeated data with iterators, scoped values, repeated blocks, and
  stable dynamic field codes
teaches:
  [
    iterators,
    repeated-data,
    item-scope,
    loop-scope,
    dynamic-field-codes,
    repeated-validation,
  ]
prerequisites: [how-expressions-work]
related:
  concept:
    [
      how-blocks-resolution-and-rendering-connect,
      clearing-answers-that-no-longer-apply,
      how-validation-works,
    ]
  reference: [iterator, loop, field, validation]
---

# Working with repeated data

Many journeys need to repeat part of a page. A user can have people in a household, tasks
in a case, addresses, or previous convictions. For each item, the journey needs to show
content, validate input, or create an answer.

Forge handles this with iterators. An iterator takes a collection and describes what to
produce for each item. The result can be component props, blocks, field codes, or
validation rules. Iterators are expressions: they describe repeated values rather than
looping with side effects.

## Iterators describe, they don't mutate

An iterator doesn't change the source collection or produce side effects. It resolves a
repeated value for the current request, the same way any other expression resolves a single
value.

```ts
Data("people").each(
  Iterator.Map({
    text: Loop.Item().path("name"),
    value: Loop.Item().path("id"),
  }),
);
```

This maps a loaded `people` collection into items a component can render. `Loop.Item()`
reads the item currently being evaluated, and `Loop` carries positional state like
`Loop.Index()` and `Loop.First()`. The reference pages cover the full iterator and loop
API.

The distinction from effects matters. Iterators create blocks, component props, validation
rules, and field codes. They don't save records, call services, or mutate application
state. That work belongs to effects, which run for their side effects rather than for a
resolved value.

## Stable answer codes across requests

Fields inside repeated blocks can write answers. Their `code` can be an expression that
includes data from the current item:

```ts
GovUKTextInput({
  code: Format("person.%1.emailAddress", Loop.Item().path("id")),
  label: Format("Email address for %1", Loop.Item().path("name")),
});
```

If the current item is `{ "id": "andrew", "name": "Andrew" }`, the field code resolves to
`person.andrew.emailAddress`. When the same person appears on the next request, the code
resolves the same way, so Forge finds and prepares the existing answer.

That stability depends on the key. A code built from an item's position (`Loop.Index()`)
breaks when the collection is sorted, filtered, or changed between requests, because the
position shifts and the old answer attaches to the wrong item. A code built from a stable
ID doesn't move with the ordering, so the answer stays attached to the real-world item it
belongs to.

## Dynamic codes and cleardown

Stable dynamic codes solve answer identity, but they create a cleardown problem.

When a branch or repeated step becomes unreachable, Forge clears the answers that belong to
it. For ordinary fields, Forge discovers the codes from the authored blocks. A dynamic code
only resolves against item data, so Forge can't list the stored keys from the block alone.

Cleardown patterns fill that gap:

```ts
step({
  path: "people-contact-details",
  title: "People contact details",
  cleardownFieldCodes: ["^person\\.[^.]+\\.emailAddress$"],
});
```

The pattern matches existing answer keys like `person.andrew.emailAddress` and
`person.jamie.emailAddress`. Forge uses it to recognise stored answers that belong to the
step. It doesn't create answer keys from the pattern.

Without a cleardown pattern, Forge can't find dynamic answers to clear, so stale answers
from unreachable steps survive when they shouldn't.

## Repeated validation shares the iterator scope

Iterators can produce validation rules as well as blocks. When the number of rules depends
on repeated data, an iterator generates one rule per item, and each rule shares the
iterator's scope:

```ts
Data("people").each(
  Iterator.Map(
    validation({
      condition: Answer(Format("person.%1.emailAddress", Loop.Item().path("id"))).match(
        Condition.Email.IsValidEmail(),
      ),
      message: Format("Enter an email address for %1", Loop.Item().path("name")),
    }),
  ),
);
```

Because the rule sits inside the iterator, it can read the current item to build the right
answer key and error message. Iterators work in `validWhen` on both steps and fields, so
repeated data takes part in page-level and answer-level validation.
