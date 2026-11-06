---
title: Hooks and lifecycle
section: building-journeys
path: building-journeys/hooks-and-lifecycle
teaches: [onAccess, onSubmission, access, submit, redirect, throw_error, hook-when, hook-execution, hook-composition, validation-groups]
prerequisites: [step, StepDefinition, journey, JourneyDefinition]
---

<p class="govuk-caption-xl">Working with data</p>

# Hooks and lifecycle

Hooks are what make steps interactive. They define what happens when
a user arrives at a page, clicks a button, or submits a form. Without
hooks, a step is a static page that cannot load data, respond to
input, or navigate anywhere.

Because Forge is stateless, hooks are where your application logic
lives. Forge does not load or persist data on your behalf. Instead,
hooks run effect functions that you provide: reading from a
database, calling an API, saving to a session, or anything else
your service needs. Forge orchestrates when they run; you decide
what they do.

{{slot:toc}}

---

## What are hooks?

There are two hook types, each running at a different point in the
request lifecycle:

| Hook | Builder | Runs on | Purpose |
|---|---|---|---|
| `onAccess` | `access()` | GET and POST | Load data, check permissions, redirect or return errors |
| `onSubmission` | `submit()` | POST only | Handle POST intents, validate, save, and navigate |

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
```

Each hook type has different execution semantics. Access hooks run
sequentially: every hook in the array gets a chance to execute. Submit
hooks use first-match semantics, where only the first matching hook
runs.

---

## The request lifecycle

When a user visits a step, Forge runs hooks in a fixed order. The
lifecycle is different for GET and POST requests.

### GET request (viewing a page)

```
1. Access lifecycle    Run onAccess hooks (journey then step)
2. Prepare answers     Bind stored answers to fields, apply defaults
3. Check navigation    Evaluate reachability, redirect if unreachable
4. Render              Evaluate blocks and display the page
```

### POST request (submitting or acting)

```
1. Access lifecycle    Run onAccess hooks (journey then step)
2. Prepare answers     Bind POST values to fields, run formatters
3. Check navigation    Evaluate reachability, redirect if unreachable
4. Submit hooks        Run onSubmission array (first match)
   4a. onAlways        Run effects that should always execute
   4b. Validate        Run validation for the requested groups
   4c. Branch          Run onValid or onInvalid based on the result
5. Render              If no redirect, display page with any validation errors
```

At any point, a redirect or error outcome stops processing immediately.
If an access hook redirects, submit hooks never run.

The access lifecycle runs first on both GET and POST. This makes it
the right place for work that must happen on every request: loading
data, checking permissions, and enforcing access rules.

---

## How each hook type executes

### Access hooks: sequential

Every hook in the `onAccess` array is evaluated in order:

1. Evaluate the `when` condition. If false, skip to the next hook.
2. If `when` is true or absent, run all `effects`.
3. Evaluate `next` outcomes in order. The first matching outcome wins.
4. If the outcome is a redirect or error, stop the entire lifecycle.
5. If no outcome matches, continue to the next hook.

Within a single hook, effects always run before `next` outcomes are
evaluated. This means you can load data and check conditions in one
hook:

```rust
access(obj! {
    "effects": [effect::call("loadItem", vec![params("itemId").into()])],
    "next": [
        throw_error(obj! {
            "when": data("item").matches(condition::is_required()),
            "status": 404,
            "message": "Item not found",
        }),
    ],
})
```

### Non-validating submit hooks

Use `"validate": false` for POST buttons that should run effects without
showing validation errors. If the hook has no redirect, the page
re-renders and values set by effects appear immediately.

```rust
submit(obj! {
    "when": post("action").matches(condition::equals("lookup")),
    "validate": false,
    "onAlways": obj! {
        "effects": [effect::call("lookupPostcode", vec![post("postcode").into()])],
    },
})
```

### Submit hooks: first match with branching

Forge evaluates each hook in the `onSubmission` array and runs the
first one whose `when` and `guards` both pass. Within the matched
hook, what happens next depends on `validate`:

**When `validate` is `false` (default):**

Only `onAlways` runs. No validation is performed.

**When `validate` is `true` or `{ groups: [...] }`:**

1. Run `onAlways` effects first, if present.
2. Validate the requested groups (`"default"` when `true`, or the
   named groups).
3. If valid: run `onValid` effects, then evaluate `onValid.next`.
4. If invalid: run `onInvalid` effects, then evaluate `onInvalid.next`.

Validation runs inside the submit hook, after `onAlways`. This
means `onAlways` effects can set up data that validation or later
branches depend on.

Using `validate: { groups: [...] }` lets different submit hooks on
the same step validate different subsets of fields. See
[Validation groups](validation#validation-groups) for the full
pattern.

Effects always run before outcomes are evaluated. Data set by an
effect is available in the `next` outcomes that follow.

---

## Outcomes: redirect and throw_error

Outcomes appear in `next` arrays within hooks. They determine what
happens after effects have run: navigate to another page, or return
an HTTP error.

### redirect

Navigates the user to another path. Halts hook processing.

```rust
redirect(obj! {
    "when": ...,  // condition for this redirect (optional)
    "goto": ...,  // destination path (required)
})
```

Static paths:

```rust
redirect(obj! { "goto": "next-step" })
redirect(obj! { "goto": "/absolute/path" })
redirect(obj! { "goto": "../../plan/overview" })
```

Dynamic paths using `format()`:

```rust
redirect(obj! { "goto": format("/items/%1/edit", [data("itemId").into()]) })
```

### throw_error

Returns an HTTP error response. Halts hook processing.

```rust
throw_error(obj! {
    "when": ...,     // condition for this error (optional)
    "status": ...,   // HTTP status code (required)
    "message": ...,  // error message (required)
})
```

```rust
throw_error(obj! { "status": 404, "message": "Item not found" })
throw_error(obj! { "status": 403, "message": "You do not have permission" })
```

### First-match semantics in next arrays

When a `next` array contains multiple outcomes, they are evaluated in
order. The first outcome whose `when` is true (or absent) wins:

```rust
"next": [
    redirect(obj! {
        "when": answer("status").matches(condition::equals("future")),
        "goto": "overview?type=future",
    }),
    redirect(obj! {
        "when": answer("status").matches(condition::equals("achieved")),
        "goto": "overview?type=achieved",
    }),
    redirect(obj! { "goto": "overview?type=current" }), // fallback (no when)
],
```

Put specific conditions first. An unconditional outcome at the end
acts as a fallback.

> `goto` does not accept `when()` or `when().then().otherwise()`.
> Use multiple `redirect()` entries with `when` conditions instead.

---

## Journey-level and step-level hooks

Journeys can define `onAccess` hooks that run for every step and
nested journey within them. Steps can define both hook types.

### Composition order

When a step belongs to a journey (or a nested child journey), Forge
runs access hooks from the **outermost ancestor inward**: root journey
first, then child journeys, then the step itself.

```
Root journey onAccess       runs first
  Child journey onAccess
    Step onAccess           runs last
```

If any hook along this chain redirects or returns an error, processing
stops immediately. Later hooks do not run.

### What is available at each level

| Hook | Journey | Step |
|---|---|---|
| `onAccess` | Yes | Yes |
| `onSubmission` | No | Yes |

Submit hooks only apply at the step level because they respond to form
submissions, which happen on individual pages.

---

## Deriving component data in hooks

Forge expressions can derive quite a lot directly in blocks. That is
useful for small, local rules: hiding a link, formatting a label, or
marking the current item in an iterator.

For larger components, it is often nicer to shape the data in an
effect first. A `derive...` effect can take API, database, session, or
query data and turn it into values that are ready for the blocks to
render:

```rust
"onAccess": [
    access(obj! {
        "effects": [
            effect::call("LoadStationPage", vec![]),
            effect::call("DeriveStationPagination", vec![]),
        ],
    }),
],
```

For example, a pagination component can be authored entirely with
`data()`, `Loop`, `format()`, and `visibleWhen` expressions. That works
well when the rules are compact. If the same page needs several
related values, such as `items`, `previous`, `next`, `pageInfo`, and
other display state, a derive effect keeps that transformation named,
tested, and close to the data loading boundary.

Use expressions when the derivation belongs to a single prop. Use a
derive effect when you are normalising external data, building a
component-shaped object, or sharing the same derived shape across more
than one block.

---

## Best practices

- **Combine effects and conditions in a single hook.** Effects run
  before `next` outcomes, so you can load data and check it in one
  hook using `when` on each outcome.
- **Put specific conditions before fallbacks.** In both hook arrays
  and `next` arrays, conditions should come first. An unconditional
  fallback at the end catches everything else.
- **Use journey-level `onAccess` for shared concerns.** If every step
  needs the same data or the same permission check, put it on the
  journey. Steps should only add access hooks for step-specific work.
- **Use distinct `value` attributes for buttons.** Each button that
  triggers a different hook needs a unique value so `when` conditions
  can tell them apart.
