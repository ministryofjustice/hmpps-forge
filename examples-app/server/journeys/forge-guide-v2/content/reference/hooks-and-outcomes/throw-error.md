---
title: throwError()
slug: throw-error
section: reference
path: reference/throw-error
nav: Authoring API/Hooks and outcomes
order: 23
description: Creates an error outcome from a hook.
teaches: [throwError, errors, outcomes, hooks, http-status]
prerequisites: [access, submit]
related:
  concept: returning-a-page-redirect-or-error
  reference: access, submit, redirect
---

# `throwError()`

`throwError()` creates a hook outcome that stops the current request and returns an
authored error. Add it to the `next` array of an [access hook](./access) or [submit hook](./submit) branch.

```typescript
const caseNotFound = throwError({
  when: Data('caseMissing'),
  status: 404,
  message: 'Case not found',
})
```

---

## Reference

### `throwError(definition)`

Call `throwError()` to create an error outcome. Add it to a hook's `next` array.

[See more examples below.](#usage)

```typescript
function throwError(definition: Omit<ThrowErrorOutcome, '_forge'>): ThrowErrorOutcome
```

#### Parameters

:::param
---
name: definition
type: Omit<ThrowErrorOutcome, '_forge'>
required: true
---
An object describing when to end the request with an error, its HTTP status, and its
message. Its properties are listed below.
:::

#### Definition properties

:::param
---
name: when
type: PredicateExpr
required: false
---
The condition that enables this error outcome. When omitted, the error outcome matches
whenever Forge evaluates it.
:::

:::param
---
name: status
type: number
required: true
---
The HTTP status code for the error. It must be an integer from `100` to `599`.
:::

:::param
---
name: message
type: string | ResolvableValue
required: true
---
The error message. It can be a plain string or an expression that resolves to a value at
request time.
:::

#### Returns

`throwError()` returns an error outcome ready to add to a hook's `next` array.

#### Caveats

- An error outcome is terminal. Once it matches, Forge skips later outcomes and the rest
  of the request pipeline.

- An [effect](./effect) can also throw an error to end a request. Use `throwError()` when the journey
  definition should make the error decision visible; throw from an effect when the error
  belongs to the application work it performs.

- The message becomes the `Error` message returned by Forge; it is not rendered page
  content. The framework adapter and application error handling decide the HTTP response.

- When a dynamic `message` resolves to `undefined`, Forge returns an error with an empty
  message.

---

## Usage

### Return an error after loading data

Use an access hook to load the state a route needs, then return an error when that state
means the request cannot continue:

```typescript
const loadApplication = access({
  effects: [ApplicationEffects.LoadApplication(Params('applicationId'))],
  next: [
    throwError({
      when: Data('applicationMissing'),
      status: 404,
      message: 'Application not found',
    }),
  ],
})
```

Forge runs the effect before it evaluates the outcome. When the application is missing,
the error ends the request before answer preparation, reachability, or rendering.

### Choose an error before a fallback redirect

Put a conditional error before a fallback redirect when a request has one outcome that
cannot continue and another that should move the user on:

```typescript
const confirmApplication = submit({
  onAlways: {
    next: [
      throwError({
        when: Answer('applicationStatus').match(Condition.Equals('withdrawn')),
        status: 410,
        message: 'This application has been withdrawn',
      }),
      redirect({ goto: 'check-answers' }),
    ],
  },
})
```

Forge checks outcomes in order. A withdrawn application returns the error; every other
request reaches the fallback redirect.

### Build a message from route data

Use an expression when the error message needs request data:

```typescript
throwError({
  when: Data('applicationMissing'),
  status: 404,
  message: Format('Application %1 was not found', Params('applicationId')),
})
```

Forge evaluates the message only when the outcome matches. For an application ID of
`42`, the returned error message is `Application 42 was not found`.

---

## Troubleshooting

### An error outcome does not run

Check that its `when` condition passes and that no earlier outcome matches first. In an
access hook, also check that the effect which loads the condition's data runs before the
outcome.

### The application does not show the expected error response

`throwError()` returns the error decision to the framework adapter. Check the
application's error handling to confirm how it renders or serialises the status and
message.
