---
title: Post()
slug: post
section: reference
path: reference/post
nav: Authoring API/References
order: 55
description: References a value from the submitted request body
teaches: [post, references, request-body, actions]
prerequisites: [step, submit]
related:
  reference: answer, query, params
---

# `Post()`

`Post()` references a value from the submitted request body. You use it to read values
that arrived in the form submission but don't belong to a field - most commonly the
`action` value from a submit button.

```typescript
import { Post } from '@ministryofjustice/hmpps-forge/core/authoring'

// Route a submit hook based on which button was clicked
when: Post('action').match(Condition.Equals('save-draft'))

// Match a button action by prefix
when: Post('action').match(Condition.String.StartsWith('remove_'))
```

Field values also arrive through the request body, but they go through answer
preparation and are read with [`Answer()`](./answer). `Post()` is for non-field values
like buttons, hidden inputs, and other form data that sits outside the field system.

---

## Reference

### `Post(key)`

Creates a reference expression that resolves to a value from the submitted request body.

```typescript
function Post(key: string): ChainableRef
```

:::param
---
name: key
type: "string"
required: true
---
The request body key to reference. Dot notation navigates into nested values if the
body value is an object.
:::

#### Returns

A `ChainableRef` - the same immutable expression builder that [`Answer()`](./answer)
returns. All the same methods are available: `.path()`, `.pipe()`, `.match()`, `.not`,
and `.each()`. See the [Answer() methods documentation](./answer#methods) for details.

---

## Usage

### Test which button submitted the form

The most common use - check the `action` value from a submit button:

```typescript
onSubmit: [
  submitHook({
    when: Post('action').match(Condition.Equals('login-admin')),
    effects: [LoginAsAdmin()],
  }),
  submitHook({
    when: Post('action').match(Condition.Equals('login-user')),
    effects: [LoginAsUser()],
  }),
]
```

Each [submit hook](./submit) runs only when its button was the one that submitted the form.

### Match a value by prefix

When several values share a pattern, match the prefix:

```typescript
when: Post('action').match(Condition.String.StartsWith('remove_'))
```

This matches `remove_0`, `remove_1`, and any other button whose `action` value starts
with `remove_`.

### Transform a post value

Chain `.pipe()` to reshape the value before using it:

```typescript
Post('action').pipe(Transformer.String.Replace('remove_', ''))
```

This strips the `remove_` prefix, leaving just the identifier.

---

## Troubleshooting

### Post() is always undefined on a GET request

`Post()` reads the submitted request body. On a GET request, there is no submission, so
`Post()` values are `undefined`. This is expected - `Post()` is meaningful only during
form submission.

### Post() values do not survive to the next request

`Post()` reads the current request's body. That body exists only during the POST
request that submitted the form. When the user moves to the next page, there is no
POST body anymore - `Post()` resolves to `undefined`.

This matters for reachability and validation checks on earlier steps. Those checks
run on every request, not just the original submission. A condition that depends on
`Post()` works during the submission but fails on every request after that.

Use [`Answer()`](./answer) for field values that need to persist. Load saved answers
back through access hooks so that reachability and validation checks find them on
later requests.
