---
title: How answers work
slug: how-answers-work
section: concepts
path: concepts/how-answers-work
nav: Answers and request state
order: 8
description:
  How field codes create answer slots, how Forge prepares them differently on GET and POST,
  and how mutation history tracks where each value came from
teaches:
  [
    fields,
    blocks,
    answers,
    field-codes,
    answer-state,
    answer-preparation,
    defaults,
    submitted-values,
    parsers,
    formatters,
    dependent-fields,
  ]
prerequisites: [how-journeys-and-steps-become-routes, how-forge-runs-a-request]
related:
  concept:
    [
      clearing-answers-that-no-longer-apply,
      how-blocks-resolution-and-rendering-connect,
      how-expressions-work,
    ]
  reference: [field, answer]
---

# How answers work

Pages are made up of blocks, some focused on content and others on input. These input
blocks, known as fields, connect inputs on a step to answers within Forge.

A page can contain headings, summaries, panels, warnings, buttons, fields, nested layouts,
and repeated content. Forge can render all of them, but only field blocks participate in
answer preparation.

## A field code is an answer key

Every field has a `code`.

```ts
GovUKTextInput({
  code: "emailAddress",
  label: "Email address",
});
```

That code is the key Forge uses to prepare, record, read, validate, and render the answer.
Other parts of the journey reference the answer by the same code:

```ts
Answer("emailAddress");
```

The code outlives everything else about the field. The component can change, the label can
change, and the page can move, but the answer keeps its key. A code that names the domain
meaning, like `emailAddress`, stays recognisable through those changes. A code that names
the widget, like `textInput1`, loses its meaning as soon as anything moves.

## Answers are shared request state

Forge starts every request with an empty answer record. Access hooks populate it by calling
`setAnswer` with values loaded from storage, an API, or session data. That is the only way
saved answers enter the request.

After answer preparation, the rest of the request reads the prepared state. Validation and
reachability use it to decide whether a step is valid and which path the user is on, while
submit hooks use it when saving data or choosing outcomes. Rendering uses the same state to
fill field values and display content.

Access hooks run before answer preparation, so they write answers into the record but
cannot read prepared answers. Later hooks and expressions read the prepared state.

This shared state is why the field code matters. It links the field on the page to the
answer that other parts of the journey read.

## Blocks can display answers without creating them

A non-field block can read answers. For example, a summary card can display
`Answer('emailAddress')`.

That doesn't make the summary card another source of the answer. It only reads the existing
answer for display. The field owns the answer key. Other blocks only read it.

## Preparation depends on the request method

Forge prepares answers differently on `GET` and `POST`.

On a `GET`, Forge starts from the answers that access hooks loaded. If a field has no
answer yet, Forge seeds it from `defaultValue`. The stored value can then be shaped for
display before rendering.

On a `POST`, Forge normalises the submitted form data, checks the component's input schema,
records the submitted value, transforms it for storage, and applies dependency clearing.
Defaults and parsers belong to `GET` preparation and do not run on `POST`.

A `GET` is about preparing display state from saved data. A `POST` is about accepting the
user's latest attempt and turning it into the answer state that validation and submission
will use.

## Formatters and parsers point in opposite directions

The value a user submits and the value Forge stores are not always the same. A date might
arrive as `"25/12/2025"` and need to become `"2025-12-25"` before anything else reads it.
The reverse is also true: a stored value and the value shown on the page can differ, because
a display format can reshape the answer for the user without changing what is saved.

Forge handles these two transformations with formatters and parsers. They both transform
values, but they run in opposite directions.

A **formatter** changes a submitted value before later request logic reads it. Formatters
run on `POST` and shape the saved answer.

A **parser** shapes a stored value for display. Parsers run on `GET` and write to a
separate display slot. A parser never changes what is saved.

Formatters prepare incoming user input, while parsers prepare outgoing display values.

:::deep-dive
---
title: Why parsers cannot change the saved answer
description: Parsers write to a separate parsed slot in the answer history, leaving the current answer untouched.
summary: Show parser mechanics
---

When a parser runs, Forge writes the result to `history.parsed`, not to `history.current`.
Rendering reads `parsed` when it exists, so the user sees the transformed display value.
But validation, submit hooks, and anything else that reads the answer still see the original
stored value.

This separation is by design. If parsers wrote to `current`, a display format like a date
pattern silently overwrites the canonical answer on every `GET`. The stored value and
the display value are different concerns, and Forge keeps them apart.

:::

## Answers can be cleared as well as written

Not all preparation adds values. Some preparation removes them.

`visibleWhen` decides whether a field renders:

```ts
GovUKTextInput({
  code: "emailAddress",
  label: "Email address",
  visibleWhen: Answer("contactMethod").match(Condition.Equals("email")),
});
```

That controls rendering only. `visibleWhen` is not part of the field's data model, so it
has no effect on answer preparation. A hidden field keeps its saved answer.

`dependentWhen` ties the answer's lifetime to a condition:

```ts
GovUKTextInput({
  code: "emailAddress",
  label: "Email address",
  visibleWhen: Answer("contactMethod").match(Condition.Equals("email")),
  dependentWhen: Answer("contactMethod").match(Condition.Equals("email")),
});
```

When the dependency is false on a `POST`, Forge clears the answer. With both props carrying
the same condition, the page and the answer state agree: the field appears when email
contact is selected, and its answer exists only while that choice holds. Later submit
hooks, validation, and rendering then see the current path's answer state, not an old value
from a branch the user moved away from.

`dependentWhen` clearing runs during `POST` preparation only. On `GET`, reachability cleardown clears stale answers from unreachable steps in a separate
phase after answer preparation.

## Every change is a recorded mutation

When Forge changes an answer, it records a mutation. Each mutation is tagged with a source
that identifies which phase wrote it: `access`, `default`, `post`, `processed`,
`dependentWhen`, `cleardown`, or `submit`.

"The answer" is the value of the latest mutation, but Forge preserves the full history and
reads it at runtime.

For example, after a failed `POST` validation, Forge re-renders the page. Rendering finds
the last `post` mutation and shows the raw value the user submitted, not a formatted or
parsed version. This is why a trimmed email address still shows as the user typed it until
they submit again.

The history also helps during debugging. Two requests can end with the same current value
for different reasons: one because the user submitted the value, another because Forge
seeded a default. The mutation source tells you which happened.

:::deep-dive
---
title: Mutation sources and the phase order
description: The complete list of mutation sources and the request phase order that produces them.
summary: Show mutation sources
---

Forge runs request phases in a fixed order. Each phase can push mutations tagged with its
source:

1. **Context preparation** sets up the request environment.
2. **Access** hooks run. They call `setAnswer` to load saved values (source `access`).
3. **Answer preparation** runs per field. On `GET`: seeds defaults (source `default`), runs
   parsers. On `POST`: normalises and records the submission (source `post`), runs
   formatters (source `processed`), evaluates `dependentWhen` (source `dependentWhen`).
4. **Validation** reads prepared answers but does not mutate them.
5. **Reachability** reads answers to decide which steps are on the current path.
6. **Answer cleardown** clears answers on steps no path reaches (source `cleardown`).
7. **Submit** hooks run on `POST` requests that reach the submission phase. They can write
   answers (source `submit`). Within a hook, `onAlways` runs before validation, followed by
   `onValid` or `onInvalid` according to the result.

Each source tells you which phase wrote the value, so the mutation history reads as a trace
of the request.

:::
