---
title: Hooks and lifecycle
section: building-journeys
path: building-journeys/hooks-and-lifecycle
teaches: [onAccess, onAction, onSubmission, access, action, submit, redirect, throwError, hook-when, hook-execution, hook-composition]
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

There are three hook types, each running at a different point in the
request lifecycle:

| Hook | Builder | Runs on | Purpose |
|---|---|---|---|
| `onAccess` | `access()` | GET and POST | Load data, check permissions, redirect or return errors |
| `onAction` | `action()` | POST only | Handle in-page actions like lookups or adding items |
| `onSubmission` | `submit()` | POST only | Validate, save, and navigate |

```typescript
import {
  access,
  action,
  submit,
  redirect,
  throwError,
  Post,
  Params,
  Query,
} from '@ministryofjustice/hmpps-forge/core/authoring'
```

Each hook type has different execution semantics. Access hooks run
sequentially: every hook in the array gets a chance to execute. Action
and submit hooks use first-match semantics, where only the first
matching hook runs.

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
4. Action hooks        Run onAction array (first match)
5. Validation          Run field and step validations if needed
6. Submit hooks        Run onSubmission array (first match)
7. Render              If no redirect, display page with any validation errors
```

At any point, a redirect or error outcome stops processing immediately.
If an access hook redirects, action and submit hooks never run.

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

```typescript
access({
  effects: [MyEffects.loadItem(Params('itemId'))],
  next: [
    throwError({
      when: Data('item').match(Condition.IsRequired()),
      status: 404,
      message: 'Item not found',
    }),
  ],
})
```

### Action hooks: first match

Forge evaluates each hook in order and runs the first one whose `when`
matches. The rest are skipped. Action effects run before blocks
render, so values set by effects appear immediately when the page
re-renders.

```typescript
action({
  when: Post('action').match(Condition.Equals('lookup')),
  effects: [MyEffects.lookupPostcode(Post('postcode'))],
})
```

### Submit hooks: first match with branching

Forge evaluates each hook in the `onSubmission` array and runs the
first one whose `when` and `guards` both pass. Within the matched
hook, what happens next depends on `validate`:

**When `validate` is `false` (default):**

Only `onAlways` runs. No validation is performed.

**When `validate` is `true`:**

1. Run `onAlways` effects first, if present.
2. Check the validation result.
3. If valid: run `onValid` effects, then evaluate `onValid.next`.
4. If invalid: run `onInvalid` effects, then evaluate `onInvalid.next`.

Effects always run before outcomes are evaluated. Data set by an
effect is available in the `next` outcomes that follow.

---

## Outcomes: redirect and throwError

Outcomes appear in `next` arrays within hooks. They determine what
happens after effects have run: navigate to another page, or return
an HTTP error.

### redirect

Navigates the user to another path. Halts hook processing.

```typescript
redirect({
  when?,  // condition for this redirect (optional)
  goto,   // destination path (required)
})
```

Static paths:

```typescript
redirect({ goto: 'next-step' })
redirect({ goto: '/absolute/path' })
redirect({ goto: '../../plan/overview' })
```

Dynamic paths using `Format()`:

```typescript
redirect({ goto: Format('/items/%1/edit', Data('itemId')) })
```

### throwError

Returns an HTTP error response. Halts hook processing.

```typescript
throwError({
  when?,     // condition for this error (optional)
  status,    // HTTP status code (required)
  message,   // error message (required)
})
```

```typescript
throwError({ status: 404, message: 'Item not found' })
throwError({ status: 403, message: 'You do not have permission' })
```

### First-match semantics in next arrays

When a `next` array contains multiple outcomes, they are evaluated in
order. The first outcome whose `when` is true (or absent) wins:

```typescript
next: [
  redirect({
    when: Answer('status').match(Condition.Equals('future')),
    goto: 'overview?type=future',
  }),
  redirect({
    when: Answer('status').match(Condition.Equals('achieved')),
    goto: 'overview?type=achieved',
  }),
  redirect({ goto: 'overview?type=current' }),  // fallback (no when)
]
```

Put specific conditions first. An unconditional outcome at the end
acts as a fallback.

> `goto` does not accept `Conditional()` or `when().then().else()`.
> Use multiple `redirect()` entries with `when` conditions instead.

---

## Journey-level and step-level hooks

Journeys can define `onAccess` hooks that run for every step and
nested journey within them. Steps can define all three hook types.

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
| `onAction` | No | Yes |
| `onSubmission` | No | Yes |

Action and submit hooks only apply at the step level because they
respond to form submissions, which happen on individual pages.

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
