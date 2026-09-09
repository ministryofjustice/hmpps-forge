---
title: Returning a page, redirect, or error
slug: returning-a-page-redirect-or-error
section: concepts
path: concepts/returning-a-page-redirect-or-error
nav: The request model
order: 5
description: How Forge request outcomes are chosen and returned to the framework adapter
teaches: [outcomes, render, redirect, error, hooks, reachability]
prerequisites: [how-forge-runs-a-request]
related:
  concept:
    [
      how-forge-decides-where-users-can-go,
      how-blocks-resolution-and-rendering-connect,
    ]
  reference: [redirect, throw-error]
---

# Returning a page, redirect, or error

A Forge request ends with an outcome. The outcome tells the framework adapter what kind of
response to send.

There are three shapes:

- render a page
- redirect, or navigate, to another URL
- return an error

This is the request decision boundary: Forge decides the journey outcome, and the adapter
turns that decision into the framework response.

## Rendering means the request can continue

A render outcome means Forge reached the point where the current step can be displayed.

Before that point, Forge ran access hooks, prepared answers, validated steps, checked
reachability, cleared stale answers, and resolved the page. The renderer then turns the
render context into framework output, such as HTML.

Rendering is not the fallback for every request. It only happens when no earlier phase
redirects or errors, and the current request reaches a renderable step.

## Redirects move the user

Redirects can come from several parts of the journey. An access hook redirects before the
page is evaluated, while a submit hook redirects after a valid submission. Reachability
moves a user away from a step that is not on their current path. A journey route sends
them to an entry point or a resume target.

Wherever the redirect comes from, the current request stops and the adapter sends a
redirect response. If a submit hook redirects after saving, Forge doesn't also render the
old step. The redirect is the outcome.

## Errors stop the request

Hooks can return errors when the request cannot continue: a missing record, denied
access, or external state that makes the requested page invalid.

An error outcome is different from a validation error. Validation errors are part of
rendering: the page re-renders so the user can correct their answers. An error outcome
stops the request itself. "Enter your date of birth" is a validation error, while "Case
not found" is an error outcome.

## Effects do work, outcomes decide

Effects load data, save data, write audit records, set cookies, or update request state.
Outcomes decide what happens next. A hook can load data with an effect, then use an
outcome to redirect or error when the loaded data shows the request cannot continue.

```ts
access({
  effects: [Effects.loadCase()],
  next: [
    throwError({
      when: Data("caseMissing"),
      status: 404,
      message: "Case not found",
    }),
  ],
});
```

The effect loads the case. The outcome decides whether the request stops.

The same split applies to submissions: a save effect persists the answers, and a redirect
outcome then moves the user to the next step.

:::deep-dive
---
title: Throwing from an effect vs throwError()
description: Both produce an error outcome. The difference is where the decision lives and how visible it is in the definition.
summary: Compare throwing with throwError
---

When an effect throws, Forge catches the error and returns it as an error outcome. The
request stops the same way it stops for a `throwError()`.

Both paths end at the adapter with an error outcome. The adapter receives a status and
message, and turns them into the application's error response.

The difference is where the decision lives.

`throwError()` is a declared outcome. It appears in the hook definition, can use a `when`
expression, and can build a message from request data with `Format()`. Forge's static
analysis and the devtools can see it.

A thrown effect buries the decision inside imperative code. Forge still produces an error
outcome, but the definition doesn't show that this hook can error. The decision is invisible
to expressions, static analysis, and anyone reading the hook shape.

The timing is also different. `throwError()` runs after all effects in the hook complete,
because Forge evaluates outcomes after effects. A thrown effect aborts immediately, so
remaining effects in that hook don't run.

Forge wraps a thrown effect in diagnostic information: the phase, the authored path, the
function name, and the function type. That helps you find where the failure started.
`throwError()` doesn't need those diagnostics because the decision is already visible in
the definition.

`throwError()` expresses a journey decision: "case not found", "user not allowed." A
thrown effect represents an operational failure: a database outage, a malformed API
response, or a failed save. Forge still returns an error outcome, but the failure is not
part of the journey's decision model.

:::

## The adapter writes the response

Forge returns the outcome, and the framework adapter turns it into the real response for
the application.

Each outcome maps to a response shape: render becomes a page, navigate becomes a
redirect, and error becomes an error response with the status and message chosen by the
journey.

That boundary keeps Forge focused on journey decisions while the adapter controls
how outcomes become responses.
