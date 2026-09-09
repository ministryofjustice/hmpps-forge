---
title: redirect()
slug: redirect
section: reference
path: reference/redirect
nav: Authoring API/Hooks and outcomes
order: 22
description: Creates a redirect outcome from a hook.
teaches: [redirect, outcomes, conditional-navigation, path-parameters]
prerequisites: [access, submit]
related:
  concept: returning-a-page-redirect-or-error, how-forge-decides-where-users-can-go
  reference: access, submit, throw-error
---

# `redirect()`

`redirect()` creates a hook outcome that stops the current request and sends the user to
another URL. Add it to the `next` array of an [access hook](./access) or [submit hook](./submit) branch.

```typescript
const continueToCheckAnswers = redirect({
  goto: 'check-answers',
})
```

---

## Reference

### `redirect(definition)`

Call `redirect()` to create a redirect outcome. Add it to a hook's `next` array.

[See more examples below.](#usage)

```typescript
function redirect(definition: Omit<RedirectOutcome, '_forge'>): RedirectOutcome
```

#### Parameters

:::param
---
name: definition
type: Omit<RedirectOutcome, '_forge'>
required: true
---
An object describing when the redirect applies and where it sends the user. Its
properties are listed below.
:::

#### Definition properties

:::param
---
name: when
type: PredicateExpr
required: false
---
The condition that enables this redirect. When omitted, the redirect matches whenever
Forge evaluates it.
:::

:::param
---
name: goto
type: string | ResolvableValue
required: true
---
The URL or path to navigate to. A plain string can be a path within the journey, an
absolute path, or an `http` or `https` URL. It can also be an expression that resolves to
the target at request time.

[See how redirect targets resolve.](#resolve-a-redirect-target)
:::

#### Returns

`redirect()` returns a redirect outcome ready to add to a hook's `next` array.

#### Caveats

- Outcomes are evaluated in order. Forge uses the first matching redirect or error
  outcome, so put an unconditional redirect after more specific outcomes.

- When a dynamic `goto` resolves to `undefined`, Forge does not redirect and continues to
  the next outcome. Add a fallback outcome when the target might be absent.

- Forge does not check that a redirect target is a registered Forge route. It resolves the
  target to a URL and returns it to the framework adapter.

---

## Usage

### Redirect after a valid submission

Put a redirect in a submit hook's `onValid` branch to continue after the selected
validation has passed:

```typescript
const contactDetailsStep = step({
  path: '/contact-details',
  title: 'Contact details',
  blocks: [emailAddressField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [ApplicationEffects.SaveContactDetails()],
        next: [redirect({ goto: 'check-answers' })],
      },
    }),
  ],
})
```

`'check-answers'` resolves against the journey's mounted path. Forge runs the save effect
first, then returns the redirect instead of rendering `contact-details` again.

### Choose a destination from earlier answers

Use conditional redirects in order when an answer decides which step comes next:

```typescript
const chooseRoute = submit({
  validate: true,
  onValid: {
    next: [
      redirect({
        when: Answer('contactMethod').match(Condition.Equals('email')),
        goto: 'email-details',
      }),
      redirect({ goto: 'phone-details' }),
    ],
  },
})
```

Forge checks the email route first. If it does not match, the unconditional redirect
provides the default destination.

### Resolve a redirect target

Forge resolves a target after it evaluates the redirect:

- A path without a leading slash, such as `'check-answers'`, resolves from the mounted
  journey path.

- A `./` or `../` path resolves from the current request path.

- A path starting with `/` resolves from the application root.

- An `http` or `https` URL is an external redirect.

Forge also replaces `:parameter` segments with [route parameters](./params) from the request:

```typescript
const applicationJourney = journey({
  path: '/applications/:applicationId',
  code: 'application',
  title: 'Application',
  steps: [
    step({
      path: '/contact-details',
      title: 'Contact details',
      // ...
      onSubmission: [
        submit({
          validate: true,
          onValid: {
            next: [redirect({ goto: 'check-answers' })],
          },
        }),
      ],
    }),
    step({
      path: '/check-answers',
      title: 'Check answers',
      // ...
    }),
  ],
})
```

For a request to `/applications/42/contact-details`, Forge resolves the relative target
against the mounted journey path and returns `/applications/42/check-answers`.


---

## Troubleshooting

### A redirect goes to an unexpected URL

Paths without a leading slash resolve from the journey's mounted path. Use a leading `/`
for an application-root path, or `./` and `../` when the target should resolve relative
to the current request URL.

### A redirect does not happen

Check that its `when` condition passes and that no earlier outcome matches first. If
`goto` is dynamic, also check that the expression resolves to a value; `undefined` falls
through to the next outcome.
