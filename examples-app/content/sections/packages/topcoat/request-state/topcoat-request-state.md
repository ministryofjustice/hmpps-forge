---
title: Request & State
section: packages
path: packages/topcoat/request-state
teaches: [RequestSnapshot, ResponseBindings, AdapterOptions.state, with_request_state, request-state, state-merging, routing]
prerequisites: [topcoat]
---

<p class="govuk-caption-xl">Topcoat Adapter</p>

# Request & State
When a request arrives, the adapter converts the Topcoat request
into a framework-agnostic `RequestSnapshot` plus a set of response
bindings, and passes both to `forge.execute()`. This page covers how
routing works, how the request is mapped, and how the fixed `state`
and per-request state merge into the state your journeys can read.

{{slot:toc}}

---

## Routing

`forge_topcoat::mount` adds a route to the Topcoat router builder
for every route in the Forge topology, handling GET (and POST where
the step accepts submissions). Route parameters in the path (such as
`:uuid` in `/goal/:uuid`) are available to the handlers.

When a journey's first step has the path `/`, the step and the
journey share a URL; the step is served.

Errors from the engine become error responses: plain text by
default, or the page your `error_page` option renders.

---

## Request mapping

Each field of the `RequestSnapshot` is filled from the Topcoat
request. Effects read the same data through the accessors on
`EffectContext`:

| Snapshot field | Topcoat source | Effect context accessor |
|----------------|----------------|-------------------------|
| `headers` | Request headers | `get_request_header(name)` / `get_all_request_headers()` |
| `cookies` | The `cookie` header | `get_request_cookie(name)` / `get_all_request_cookies()` |
| `params` | Route parameters | `get_request_param(key)` / `get_all_request_params()` |
| `query` | Query string (`a[b]` keys build nested objects) | `get_query_param(key)` / `get_all_query_params()` |
| `post` | URL-encoded POST body (`a[b]` keys build nested objects) | `get_post_data(key)` / `get_all_post_data()` |
| `session` | The adapter's session store | `get_session()` |
| `state` | Merged state (see State merging below) | `get_state(key)` / `get_all_state()` |
| `location` | Derived from the `host` header and the request URI | `get_request_url()` |

The adapter accepts only `application/x-www-form-urlencoded` POST
bodies (other types get a 415), up to 1 MB.

### Base path resolution

The snapshot's `location.basePath` is resolved from the actual
URL, not from the route pattern. For example, a route
mounted at `/goal/:uuid` with a request to
`/goal/89e9a810-.../create-goal` produces `/goal/89e9a810-...`
as the base path, not `/goal/:uuid`.

This means expressions like `request::path()` and authoring
helpers that depend on the current URL always see the resolved
path with real parameter values.

---

## State merging

When the adapter builds the snapshot, it merges three sources
into the snapshot's `state`:

```
state = { ...options.state, ...request_state(request), csrfToken, cspNonce }
```

This means:

1. **`AdapterOptions::state`** - application-level values (the
   service name, environment flags) form the base layer.
2. **Per-request state** - the object returned by the function you
   pass to `AdapterOptions::with_request_state` (e.g. user details,
   feature flags) is merged over the base layer for each request.
3. **`csrfToken` and `cspNonce`** - set by the adapter itself when
   the `csrf` and `csp_nonce` options are on.

### Accessing state in journeys

Inside a journey, effects and hooks access these merged values
through `request::state()`. For example, with the `csrf` option on:

```rust
// In an expression
request::state("csrfToken")

// In an effect
context.get_state("csrfToken")
context.get_all_state()
```

Both return the merged value - there is no need to know
which layer it was originally set on.

---

## Why this matters

Applications usually pass data computed per request (the signed-in
user, feature flags) to views. The per-request state function is
where that happens for Forge: whatever it returns is available as
state inside your journeys and as variables in your templates.

Values that are the same for every request belong in `state`
instead; per-request values take precedence over them.

### Common patterns

**CSRF tokens** - with the `csrf` option on, the adapter sets
`csrfToken`, so your components and templates can read it via
`request::state("csrfToken")`.

**User identity** - if your per-request state function returns a
`user`, your journeys can reference user properties with
`request::state("user")` without any extra plumbing.

**Feature flags** - flags returned by the per-request state function
become available as state, so you can use them in `visibleWhen` or
`entryWhen` predicates.

**Request-scoped objects** - the per-request state function can
return objects that effects use later in the same request. This is
useful for values that depend on the current user, such as an
authenticated API client. Wrap the object as an opaque value, so
it travels through state without being converted to data:

```rust
use std::any::Any;
use std::sync::Arc;

use forge_core::Value;
use forge_core::value::OpaqueValue;

/// An API client authenticated as the request's user.
#[derive(Clone)]
pub struct AuthenticatedClient(pub Arc<ApiClient>);

impl OpaqueValue for AuthenticatedClient {
    fn view(&self) -> Value {
        Value::empty_object()
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}

let options = AdapterOptions { state: obj! { "serviceName": "My service" }, ..AdapterOptions::default() }
    .with_request_state(move |request| {
        let auth = auth.clone();
        async move {
            let user = auth.user_for(&request.headers).await;
            obj! {
                "user": user.to_value(),
                "authenticatedClient": Value::opaque(AuthenticatedClient(auth.client_for(&user))),
            }
        }
    });
```

The effect can then read the same object from the Forge context:

```rust
FunctionEntry::effect("LoadClientDetails", move |context, args| {
    let api_service = api_service.clone();
    async move {
        let state = context.get_state("authenticatedClient");
        let Some(AuthenticatedClient(client)) = state.downcast::<AuthenticatedClient>().cloned() else {
            return Ok(());
        };

        let client_details = api_service.get_client_details(&client, &args[0].to_js_string()).await?;

        context.set_data("clientDetails", client_details)
    }
})
```

Templates see an opaque value's `view()` (an empty object here),
never the client itself.

---

## Response mapping

The adapter also collects response headers and cookies as a set of
`ResponseBindings`, giving effects a framework-agnostic way to
set them via the effect context:

| Effect context method | Behaviour |
|-----------------------|-----------|
| `set_response_header(name, value)` | Adds the header to the response |
| `set_response_cookie(name, value, options)` | Adds a `set-cookie` header, with optional `CookieOptions` (`http_only`, `secure`, `same_site`, `max_age`, `path`, `domain`, `expires`) |

The bindings are write-only - effects cannot read back headers
or cookies set earlier in the same request. To clear a cookie,
set it with `max_age: Some(0.0)`.
