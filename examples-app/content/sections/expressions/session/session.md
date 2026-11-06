---
title: Session
section: authoring-language
path: authoring-language/session
teaches: [session, session-data, server-side-session]
prerequisites: [step, StepDefinition]
---

<p class="govuk-caption-xl">References</p>

# Session

`session()` references data from the server-side session. Where
`data()` holds values scoped to a single request, `session()` gives
your definitions access to persistent state that lives across
requests, like the current user, their permissions, or feature
flags.

{{slot:toc}}

---

## What is Session?

The session is managed by your application, not by Forge. It
typically holds information set during authentication or
application setup: who the user is, what they can access, and
any configuration that applies to their visit. `session()` lets
your journey definitions read from it directly.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};

session("user.name")
```

How the session is populated depends on your application. Forge
does not write to the session itself. It only reads from whatever
the framework adapter provides.

---

## How it works

When Forge evaluates `session("user.name")`, it reads the value
from the session object provided by the framework adapter. Dot
notation walks nested properties, so `session("user.name")` looks
up `name` within `user` within the session.

In effect functions, the session is available through
`context.get_session()`:

```rust
FunctionEntry::effect("LoadUserData", move |context, _args| {
    let api = api.clone();
    async move {
        let session = context.get_session();
        let profile = api.get_profile(&session.get("user").get("id")).await?;
        context.set_data("profile", profile)
    }
})
```

---

## Using in your definitions

### Displaying session values

Show the current user's name or other session information:

```rust
core_blocks::HTML.build(obj! {
    "content": format("Signed in as %1", [session("user.name").into()]),
})
```

---

## API surface

### `session(key)`

Creates a reference to a value in the server-side session.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
```

`key` is a string with optional dot notation for nested access.

Returns a chainable reference that supports `.path()`, `.matches()`,
`.pipe()`, and `.each()`.

---

## Best practices

- **Use `session()` for values that outlive a single request.**
  User identity, permissions, and feature flags persist across
  requests. Per-request data loaded by effects belongs in `data()`
  instead.
- **Use dot notation to reach nested properties.**
  `session("user.name")` is clearer than loading the whole session
  object and navigating in the block.
