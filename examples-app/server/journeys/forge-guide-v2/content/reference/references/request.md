---
title: Request
slug: request
section: reference
path: reference/request
nav: Authoring API/References
order: 58
description: References metadata from the current HTTP request
teaches: [request, references, headers, cookies, state]
prerequisites: [step, access]
related:
  reference: params, query, post
---

# `Request`

`Request` exposes metadata about the current HTTP request. You call one of its methods
to reference the URL, path, method, a header, a cookie, or adapter-managed state.

```typescript
import { Request } from '@ministryofjustice/hmpps-forge/core/authoring'

// Match the request path
Request.Path().match(Condition.Equals('/dashboard'))

// Read adapter state (for example, a CSRF token from Express res.locals)
Request.State('csrfToken')

// Check the HTTP method
Request.Method().match(Condition.Equals('POST'))
```

`Request` is an object with methods, not a function. You never write `Request()` -
you call a specific method like `Request.Path()` or `Request.Headers('accept')`.

---

## Reference

### Methods

Each method returns a `ChainableRef` - the same immutable expression builder that
[`Answer()`](./answer) returns. All the same chainable methods are available: `.path()`,
`.pipe()`, `.match()`, `.not`, and `.each()`. See the
[Answer() methods documentation](./answer#methods) for details.

#### `Request.Url()`

Resolves to the full URL of the current request.

```typescript
Request.Url(): ChainableRef
```

#### `Request.Path()`

Resolves to the pathname of the current request, without the query string.

```typescript
Request.Path(): ChainableRef
```

#### `Request.Method()`

Resolves to the HTTP method of the current request (`'GET'` or `'POST'`).

```typescript
Request.Method(): ChainableRef
```

#### `Request.Headers(name)`

Resolves to a request header value.

```typescript
Request.Headers(name: string): ChainableRef
```

:::param
---
name: name
type: "string"
required: true
---
The header name to reference. Used as-is - dot notation does not apply here.
:::

#### `Request.Cookies(name)`

Resolves to a cookie value from the request.

```typescript
Request.Cookies(name: string): ChainableRef
```

:::param
---
name: name
type: "string"
required: true
---
The cookie name to reference. Used as-is - dot notation does not apply here.
:::

#### `Request.State(key)`

Resolves to a value from the adapter's request state. In Express, this reads from
`res.locals`.

```typescript
Request.State(key: string): ChainableRef
```

:::param
---
name: key
type: "string"
required: true
---
The state key to reference. Dot notation navigates into nested values:
`Request.State('auth.userId')` reads the `userId` property from the `auth` state
entry.
:::

---

## Usage

### Test the request path

Use `.match()` to test the path against a condition:

```typescript
onAccess: [
  access({
    when: Request.Path().match(Condition.Equals('/case-management')),
    next: [redirect({ goto: 'dashboard' })],
  }),
]
```

### Read adapter state

Adapter-managed state like CSRF tokens is available through `Request.State()`:

```typescript
GovUKForm({
  values: { csrfToken: Request.State('csrfToken') },
})
```

The adapter (for example, Express middleware) writes the token into request state,
and `Request.State()` reads it during rendering.

### Test the HTTP method

```typescript
when: Request.Method().match(Condition.Equals('POST'))
```

---

## Troubleshooting

### Request values are undefined in reachability expressions

`Request` references resolve at request time only. They are not available during
reachability evaluation, where no live HTTP request exists. Use [`Data()`](./data) or
[`Session()`](./session) for values that reachability expressions need.
