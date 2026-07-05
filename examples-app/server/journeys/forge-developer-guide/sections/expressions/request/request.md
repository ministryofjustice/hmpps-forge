---
title: Request
section: authoring-language
path: authoring-language/request
teaches: [Request, Request.Url, Request.Path, Request.Method, Request.Headers, Request.Cookies, Request.State]
prerequisites: []
---

<p class="govuk-caption-xl">References</p>

# Request

`Request` is a namespace of methods that reference metadata from
the current HTTP request: the URL, the method, headers, cookies,
and request state. Where `Params()`, `Query()`, and `Post()`
reference specific parts of the request, `Request` covers
everything else.

{{slot:toc}}

---

## What is Request?

Most request data is best accessed through a specific reference
type. Route parameters have `Params()`, query strings have
`Query()`, and form bodies have `Post()`. `Request` exists for the
cases where you need something outside those categories: the full
URL, the HTTP method, a specific header, or a cookie value.

```typescript
import { Request } from '@ministryofjustice/hmpps-forge/core/authoring'

Request.Path()
Request.Headers('accept-language')
```

Unlike the other reference types, `Request` is a namespace with
multiple methods rather than a single function. Each method
references a different aspect of the request.

---

## Available methods

### `Request.Url()`

The full request URL.

### `Request.Path()`

The pathname from the request URL, without query string.

### `Request.Method()`

The HTTP method: `'GET'`, `'POST'`, and so on.

### `Request.Headers(name)`

A specific request header by name.

```typescript
Request.Headers('accept-language')
```

### `Request.Cookies(name)`

A specific request cookie by name.

```typescript
Request.Cookies('session-id')
```

### `Request.State(key)`

Request state provided by the framework adapter. Supports dot
notation for nested access.

```typescript
Request.State('user.name')
```

What appears in request state depends on the framework adapter.
The Express adapter merges `app.locals`, `res.locals`, and
`req.state`, making it useful for values set by upstream
middleware.

All methods return a chainable reference that supports `.path()`,
`.match()`, `.pipe()`, and `.each()`.

---

## Best practices

- **Prefer specific references where they exist.** Use `Params()`
  for route parameters, `Query()` for query strings, `Post()` for
  form data, and `Session()` for session values. Reach for `Request`
  only when none of those cover what you need.
- **Use `Request.State()` for middleware-provided values.** If your
  middleware sets values on the response locals (or equivalent),
  `Request.State()` is how your definitions can access them.
