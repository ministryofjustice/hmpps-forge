---
title: Request
section: authoring-language
path: authoring-language/request
teaches: [request, request::url, request::path, request::method, request::headers, request::cookies, request::state]
prerequisites: []
---

<p class="govuk-caption-xl">References</p>

# Request

`Request` is a namespace of methods that reference metadata from
the current HTTP request: the URL, the method, headers, cookies,
and request state. Where `params()`, `query()`, and `post()`
reference specific parts of the request, `Request` covers
everything else.

{{slot:toc}}

---

## What is Request?

Most request data is best accessed through a specific reference
type. Route parameters have `params()`, query strings have
`query()`, and form bodies have `post()`. `Request` exists for the
cases where you need something outside those categories: the full
URL, the HTTP method, a specific header, or a cookie value.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};

request::path()
request::headers("accept-language")
```

Unlike the other reference types, `Request` is a namespace with
multiple methods rather than a single function. Each method
references a different aspect of the request.

---

## Available methods

### `request::url()`

The full request URL.

### `request::path()`

The pathname from the request URL, without query string.

### `request::method()`

The HTTP method: `"GET"`, `"POST"`, and so on.

### `request::headers(name)`

A specific request header by name.

```rust
request::headers("accept-language")
```

### `request::cookies(name)`

A specific request cookie by name.

```rust
request::cookies("session-id")
```

### `request::state(key)`

Request state provided by the framework adapter. Supports dot
notation for nested access.

```rust
request::state("user.name")
```

What appears in request state depends on the framework adapter.
The Topcoat adapter merges its fixed `state` with the per-request
state from `AdapterOptions::with_request_state`, making it useful
for values such as the signed-in user.

All methods return a chainable reference that supports `.path()`,
`.matches()`, `.pipe()`, and `.each()`.

---

## Best practices

- **Prefer specific references where they exist.** Use `params()`
  for route parameters, `query()` for query strings, `post()` for
  form data, and `session()` for session values. Reach for `Request`
  only when none of those cover what you need.
- **Use `request::state()` for middleware-provided values.** If your
  middleware sets values on the response locals (or equivalent),
  `request::state()` is how your definitions can access them.
