---
title: Post
section: authoring-language
path: authoring-language/post
teaches: [Post, post-body, form-submission-data]
prerequisites: [step, StepDefinition, onSubmission, submit]
---

<p class="govuk-caption-xl">References</p>

# Post

`Post()` references values from the request body on form submission.
Its most common use is distinguishing which button the user pressed
when a step has more than one.

{{slot:toc}}

---

## What is Post?

When a form is submitted, every named input in the form is sent in
the request body. `Post()` creates a reference to these values by
name. `Post()` gives you access to the raw submitted values,
including ones that are not declared as fields in your step
definition, like button names and hidden inputs.

```typescript
import { Post } from '@ministryofjustice/hmpps-forge/core/authoring'

Post('action')
```

The primary use case is matching buttons. When a step has multiple
submit buttons, each one sends a different value, and hooks use
`Post()` to determine which was pressed:

```typescript
GovUKButton({ text: 'Save and continue', name: 'action', value: 'continue' })
GovUKButton({ text: 'Save as draft', name: 'action', value: 'saveDraft' })
```

```typescript
onSubmission: [
  submit({
    when: Post('action').match(Condition.Equals('continue')),
    validate: true,
    onValid: {
      effects: [MyEffects.SaveAnswers()],
      next: [redirect({ goto: 'next-step' })],
    },
  }),
  submit({
    when: Post('action').match(Condition.Equals('saveDraft')),
    onAlways: {
      effects: [MyEffects.SaveDraft()],
      next: [redirect({ goto: '/dashboard' })],
    },
  }),
]
```

---

## How it works

When Forge evaluates `Post('action')`, it reads the value from the
parsed request body. On GET requests, there is no body, so `Post()`
references resolve to `undefined`. This makes `Post()` only
meaningful in `onSubmission` hooks, which run on POST
requests.

The framework adapter parses the request body and makes values
available as strings, or arrays of strings for repeated names.

In effect functions, the same values are available through
`context.getPostData<T>(key)`:

```typescript
RemoveItem: (deps) => async (context) => {
  const action = context.getPostData<string>('action')

  if (typeof action !== 'string') {
    return
  }

  const index = Number(action.replace('remove_', ''))
  await deps.store.removeItem(context.sessionId, index)
}
```

Use `context.getAllPostData<T>()` when an effect needs the whole
POST body as an object:

```typescript
const postData = context.getAllPostData<{ action?: string }>()
```

---

## Using in your definitions

### Multiple submit buttons

The most common pattern. Each button shares the same `name` but has
a different `value`, and hooks match on it:

```typescript
GovUKButton({ text: 'Add steps', name: 'action', value: 'addSteps' })
GovUKButton({ text: 'Save without steps', name: 'action', value: 'saveWithoutSteps' })
```

```typescript
onSubmission: [
  submit({
    when: Post('action').match(Condition.Equals('addSteps')),
    validate: true,
    onValid: {
      effects: [MyEffects.CreateGoal()],
      next: [redirect({ goto: Format('../%1/add-steps', Data('goalUuid')) })],
    },
  }),
  submit({
    when: Post('action').match(Condition.Equals('saveWithoutSteps')),
    validate: true,
    onValid: {
      effects: [MyEffects.CreateGoal()],
      next: [redirect({ goto: '../../plan/overview' })],
    },
  }),
]
```

### In-page actions

Non-validating submit hooks use `Post()` the same way. A secondary
button might trigger a lookup without leaving the page:

```typescript
submit({
  when: Post('action').match(Condition.Equals('lookup')),
  validate: false,
  onAlways: {
    effects: [MyEffects.LookupPostcode(Post('postcode'))],
  },
})
```

Here `Post()` serves double duty: matching which button was pressed
and passing a submitted value into the effect.

### Pattern matching on button values

When buttons encode information in their values, string conditions
can extract meaning without parsing:

```typescript
submit({
  when: Post('action').match(Condition.String.StartsWith('remove_')),
  validate: false,
  onAlways: {
    effects: [MyEffects.RemoveItem()],
  },
})
```

This matches any button whose value starts with `remove_`, such as
`remove_0`, `remove_1`, and so on. The effect can read the full
value from `context.getPostData<string>('action')` to determine
which item to remove.

---

## API surface

### `Post(key)`

Creates a reference to a value in the request body.

```typescript
import { Post } from '@ministryofjustice/hmpps-forge/core/authoring'
```

`key` is a string matching the `name` attribute of a form input.
Supports dot notation for nested access.

Returns a chainable reference that supports `.path()`, `.match()`,
`.pipe()`, and `.each()`.

---

## Best practices

- **Keep `Post()` in hooks, not blocks.** `Post()` is only
  meaningful on POST requests. Using it in block properties like
  `visibleWhen` will resolve to `undefined` on the initial GET
  render.
- **Do not use `Post()` in redirect conditions.** Redirects can
  run during traversal checks on GET requests, where there is no
  POST body. Use `Answer()` or `Data()` for redirect conditions
  instead.
- **Mark `Post()`-based validations as `submissionOnly`.** If a
  validation rule depends on a `Post()` value, set
  `submissionOnly: true` so it is skipped during traversal checks,
  where the POST body is not available.
