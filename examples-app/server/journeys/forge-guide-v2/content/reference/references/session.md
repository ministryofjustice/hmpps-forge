---
title: Session()
slug: session
section: reference
path: reference/session
nav: Authoring API/References
order: 54
description: References a value from the server-side session
teaches: [session, references, persistence, getSession]
prerequisites: [step, access]
related:
  reference: data, answer
  how-to: creating-your-own-custom-effect
---

# `Session()`

`Session()` references a value from the server-side session. You use it to read values
that persist across requests - a signed-in user's role, a feature flag, or a marker
that a previous step was completed.

```typescript
import { Session } from '@ministryofjustice/hmpps-forge/core/authoring'

// Display a session value
Format('Signed in as %1', Session('user.name'))

// Test a session value
Session('user.role').match(Condition.Equals('admin'))

// Guard on a missing session key
Session('user').not.match(Condition.IsRequired())
```

Unlike [`Data()`](./data), which holds values for a single request, session values
survive across requests. The adapter (for example, express-session) handles persistence
- the engine reads and writes the session object but does not own its storage.

---

## Reference

### `Session(key)`

Creates a reference expression that resolves to a value from the server-side session.

```typescript
function Session(key: string): ChainableRef
```

:::param
---
name: key
type: "string"
required: true
---
The session key to reference. Dot notation navigates into nested values:
`Session('user.role')` reads the `role` property from the `user` session entry.
:::

#### Returns

A `ChainableRef` - the same immutable expression builder that [`Answer()`](./answer)
returns. All the same methods are available: `.path()`, `.pipe()`, `.match()`, `.not`,
and `.each()`. See the [Answer() methods documentation](./answer#methods) for details.

---

## Usage

### Display a session value

Use a reference in a component property or a format expression:

```typescript
Format('Signed in as %1 (%2).', Session('user.name'), Session('user.role'))
```

The format string resolves both session values into the displayed text.

### Navigate into a nested value

When a session entry is an object, use dot notation to reach a property:

```typescript
Session('user.role')
```

Each segment uses optional chaining, so a missing intermediate produces `undefined`
rather than an error. `.path()` does the same thing and is useful when chaining after
another operation:

```typescript
Session('user').path('role')
```

### Control visibility with a session value

Test a session value to show or hide content:

```typescript
visibleWhen: Session('user.role').match(Condition.Equals('admin'))
```

This makes the block visible only when the session holds an `admin` role.

### Guard a step on a session value

Use a session reference in a step guard to redirect when a value is missing:

```typescript
when: Session('user').not.match(Condition.IsRequired()),
redirect: '/sign-in',
```

This redirects to sign-in when no `user` key exists in the session.

### Control step reachability

Session values can drive which steps are reachable:

```typescript
step({
  reachability: {
    entryWhen: Session('completedOnboarding').match(Condition.Equals(true)),
  },
  // ...
})
```

The step is reachable only when the session's `completedOnboarding` key is `true`.

---

## Writing session values

`Session()` is read-only in expressions. To write a session value, use
`context.getSession()` inside an [effect function](./effect) and mutate the returned object in
place:

```typescript
const saveLoginToSession = effect('Auth.SaveLoginToSession', {
  factory: () => (context) => {
    const session = context.getSession()
    session.user = {
      name: context.getAnswer('userName'),
      role: context.getAnswer('selectedRole'),
    }
  },
})
```

There is no `setSession()` method. The adapter persists the mutated session object
after the request completes.

---

## Troubleshooting

### The session value is always undefined

A missing session key resolves silently to `undefined`. Check two things:

- Does the key string match the property name set in the effect? A mismatched key
  produces `undefined` rather than an error.
- Does the effect that writes the session value run before the expression that reads it?
  A session value set in a submit hook is available on the next request, but not during
  the same request unless an earlier hook in the same phase wrote it.

### Session values disappear between requests

The adapter owns session persistence. If session values disappear, check that the
adapter's session middleware is configured and that its storage backend is working. The
engine reads and writes the session object but does not persist it.
