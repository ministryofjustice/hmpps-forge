---
title: Request & State
section: packages
path: packages/express-nunjucks/request-state
teaches: [RequestSnapshot, ResponseBindings, req.state, res.locals, Request.State, state-merging, routing, mergeParams]
prerequisites: [express-nunjucks]
---

<p class="govuk-caption-xl">Express-Nunjucks Adapter</p>

# Request & State
When a request arrives, the adapter converts the Express
`req`/`res` pair into a framework-agnostic `RequestSnapshot`
plus a set of response bindings, and passes both to
`forge.execute()`. This page covers how routing works, how the
request is mapped, and how `res.locals` and `req.state` merge
into the state your journeys can read.

{{slot:toc}}

---

## Routing

`createExpressRouter` creates a single Express router and
registers a GET or POST handler on it for every route in the
Forge topology. The router is created with `mergeParams: true`,
so route parameters from the path the router is mounted under
(such as `:uuid` in `/goal/:uuid`) are available to the
handlers.

GET and POST handlers are wrapped with async error handling:
any rejected promise is forwarded to Express's `next(error)`
so your error middleware can handle it.

---

## Request mapping

Each field of the `RequestSnapshot` is filled from the Express
request. Effects read the same data through the typed accessors
on `EffectFunctionContext`:

| Snapshot field | Express source | Effect context accessor |
|----------------|----------------|-------------------------|
| `headers` | `req.headers` | `getRequestHeader(name)` / `getAllRequestHeaders()` |
| `cookies` | `req.cookies` | `getRequestCookie(name)` / `getAllRequestCookies()` |
| `params` | `req.params` (route parameters) | `getRequestParam(key)` / `getAllRequestParams()` |
| `query` | `req.query` (query string) | `getQueryParam(key)` / `getAllQueryParams()` |
| `post` | `req.body` (POST body) | `getPostData(key)` / `getAllPostData()` |
| `session` | `req.session` | `getSession()` |
| `state` | Merged state (see State merging below) | `getState(key)` / `getAllState()` |
| `location` | Derived from `req.protocol`, `req.hostname`, and `req.originalUrl` | `getRequestUrl()` |

### Base path resolution

The snapshot's `location.basePath` is resolved from the actual
URL, not from Express's route pattern. For example, a route
mounted at `/goal/:uuid` with a request to
`/goal/89e9a810-.../create-goal` produces `/goal/89e9a810-...`
as the base path, not `/goal/:uuid`.

This means expressions like `Request.Path()` and authoring
helpers that depend on the current URL always see the resolved
path with real parameter values.

---

## State merging

When the adapter builds the snapshot, it merges three sources
into the snapshot's `state`:

```
state = { ...req.app.locals, ...res.locals, ...req.state }
```

This means:

1. **`req.app.locals`** - application-level values (minus
   Express's own `settings`) form the base layer.
2. **`res.locals`** - values set by upstream Express middleware
   (e.g. CSRF tokens, user details, feature flags) become part
   of the request state automatically, overriding `app.locals`.
3. **`req.state`** - values set explicitly on `req.state` by
   earlier middleware take priority over both when keys
   overlap.

### Accessing state in journeys

Inside a journey, effects and hooks access these merged values
through `Request.State()`. For example, if upstream middleware
sets `res.locals.csrfToken`:

```typescript
import { Request } from '@ministryofjustice/hmpps-forge/core/authoring'

// In an expression
Request.State('csrfToken')

// In an effect
context.getState('csrfToken')
context.getAllState()
```

Both return the merged value - there is no need to know
whether it was originally set on `res.locals` or `req.state`.

---

## Why this matters

Many Express applications use `res.locals` to pass data from
middleware to views. The adapter bridges this convention into
Forge's request model, so you don't need to change how your
middleware works. Any value in `res.locals` is automatically
available as state inside your journeys.

If you need to set state explicitly for Forge without affecting
`res.locals`, set it on `req.state` instead - those values
take precedence.

### Common patterns

**CSRF tokens** - middleware like `csurf` typically sets
`res.locals.csrfToken`. Forge picks this up automatically,
so your components can read it via `Request.State('csrfToken')`.

**User identity** - if authentication middleware sets
`res.locals.user`, your journeys can reference user properties
with `Request.State('user')` without any extra plumbing.

**Feature flags** - flags set on `res.locals` by a feature
flag middleware become available as state, so you can use them
in `visibleWhen` or `entryWhen` predicates.

**Middleware outputs** - middleware can attach request-scoped
objects to `req.state` so effects can use them later in the same
request. This is useful for values that depend on the current user,
such as an authenticated API client.

```typescript
import type { AxiosInstance } from 'axios'

declare global {
  namespace Express {
    interface RequestState {
      authenticatedAxios: AxiosInstance
    }

    interface Request {
      state: RequestState
    }
  }
}

app.use((req, res, next) => {
  req.state = {
    ...req.state,
    authenticatedAxios: createAuthenticatedAxios(req.user),
  }

  next()
})
```

The effect can then read the same object from the Forge context:

```typescript
import type { EffectFunctionContext } from '@ministryofjustice/hmpps-forge/core/authoring'

type MyEffectContext = EffectFunctionContext<
  Record<string, unknown>,
  Record<string, unknown>,
  unknown,
  Express.RequestState
>

LoadClientDetails: (deps) => async (context: MyEffectContext, caseReference: string) => {
  const authenticatedAxios = context.getState('authenticatedAxios')

  if (!authenticatedAxios) {
    return
  }

  const clientDetails = await deps.apiService.getClientDetails(
    authenticatedAxios,
    caseReference,
  )

  context.setData('clientDetails', clientDetails)
}
```

`req.state` stores another reference to the same request-scoped
object. It does not need to replace existing middleware fields like
`req.axiosMiddleware` immediately, but using `req.state` is the
adapter-supported path for making those values available to Forge.

---

## Response mapping

The adapter also wraps the Express response as a set of
`ResponseBindings`, giving effects a framework-agnostic way to
set headers and cookies via the effect context:

| Effect context method | Behaviour |
|-----------------------|-----------|
| `setResponseHeader(name, value)` | Calls `res.setHeader()` |
| `setResponseCookie(name, value, options?)` | Calls `res.cookie()` with optional settings (httpOnly, secure, sameSite, maxAge, path, domain, expires) |

The bindings are write-only - effects cannot read back headers
or cookies set earlier in the same request. To clear a cookie,
set it with `maxAge: 0`.
