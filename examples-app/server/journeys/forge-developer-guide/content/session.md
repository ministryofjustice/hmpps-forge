---
title: Session
section: authoring-language
path: authoring-language/session
teaches: [Session, session-data, server-side-session]
prerequisites: [step, StepDefinition]
---

<p class="govuk-caption-xl">References</p>

# Session

`Session()` references data from the server-side session. Where
`Data()` holds values scoped to a single request, `Session()` gives
your definitions access to persistent state that lives across
requests, like the current user, their permissions, or feature
flags.

{{slot:toc}}

---

## What is Session?

The session is managed by your application, not by Forge. It
typically holds information set during authentication or
application setup: who the user is, what they can access, and
any configuration that applies to their visit. `Session()` lets
your journey definitions read from it directly.

```typescript
import { Session } from '@ministryofjustice/hmpps-forge/core/authoring'

Session('user.name')
```

How the session is populated depends on your application. Forge
does not write to the session itself. It only reads from whatever
the framework adapter provides.

---

## How it works

When Forge evaluates `Session('user.name')`, it reads the value
from the session object provided by the framework adapter. Dot
notation walks nested properties, so `Session('user.name')` looks
up `name` within `user` within the session.

In effect functions, the session is available through
`context.getSession()`:

```typescript
LoadUserData: (deps) => async (context) => {
  const session = context.getSession()
  const profile = await deps.api.getProfile(session.user.id)
  context.setData('profile', profile)
}
```

---

## Using in your definitions

### Displaying session values

Show the current user's name or other session information:

```typescript
HtmlBlock({
  content: Format('Signed in as %1', Session('user.name')),
})
```

---

## API surface

### `Session(key)`

Creates a reference to a value in the server-side session.

```typescript
import { Session } from '@ministryofjustice/hmpps-forge/core/authoring'
```

`key` is a string with optional dot notation for nested access.

Returns a chainable reference that supports `.path()`, `.match()`,
`.pipe()`, and `.each()`.

---

## Best practices

- **Use `Session()` for values that outlive a single request.**
  User identity, permissions, and feature flags persist across
  requests. Per-request data loaded by effects belongs in `Data()`
  instead.
- **Use dot notation to reach nested properties.**
  `Session('user.name')` is clearer than loading the whole session
  object and navigating in the block.
