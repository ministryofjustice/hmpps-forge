---
title: Effects
section: authoring-language
path: authoring-language/effects
teaches: [effects, effect-references-in-hooks, effect-arguments]
prerequisites: [onAccess, onSubmission, access, submit, Data, Answer]
---

<p class="govuk-caption-xl">Functions</p>

# Effects

Effects are where your application logic lives. They run inside
hooks and are the bridge between Forge's declarative definitions
and the outside world: loading data from APIs, saving answers to a
data store, sending audit events, or anything else your service
needs. Forge orchestrates when they run; your implementations decide
what they do.

{{slot:toc}}

---

## What is an effect?

Conditions, transformers, and generators are all pure functions.
They take a value and return a result without touching anything
outside the expression system. Effects are different. They can read
and write answers, set data for the current request, access the
session, and call external services.

Effects do not appear in block properties. They only appear inside
hooks, listed in the `effects` array:

```typescript
onAccess: [
  access({
    effects: [MyEffects.LoadCaseData(Params('caseId'))],
  }),
]
```

Multiple effects in the same array run in sequence. Each one
completes before the next starts.

---

## How it works

### Arguments from the definition

Effects can accept arguments. The values in the definition can be
static or expressions, and Forge resolves them before calling the
effect:

```typescript
// Static argument
effects: [MyEffects.LoadCaseData('123')]

// Dynamic argument
effects: [MyEffects.LoadCaseData(Params('caseId'))]
```

When the hook runs, `Params('caseId')` is resolved to the actual
value from the URL, then passed to the effect.

### What effects can do

Effects have access to a context object that exposes the current
request's state. Through this context they can:

- **Read and write answers** – `context.getAnswer(code)`,
  `context.setAnswer(code, value)`, `context.hasAnswer(code)`,
  `context.getAllAnswers()`.
- **Set data for the current request** – `context.setData(key, value)`
  makes a value available through `Data(key)` for the rest of the
  request.
- **Read request information** – `context.getRequestParam(key)`,
  `context.getQueryParam(key)`, `context.getPostData(key)`,
  `context.getAllPostData()`, `context.getSession()`.
- **Inspect reachability** – `context.getFieldsToClear()` returns
  answer keys from steps that are no longer reachable. Forge has
  already cleared their values; use the list to drop the keys from
  your own store.

From the authoring side, you usually do not need to know the exact
method names. The effect hides that detail behind a named operation
like `LoadCaseData` or `SaveAnswers`. The names in this list are
useful when you are reading or writing effect implementations.

---

## Using in your definitions

Effects are referenced in hooks using the effect builders produced
by the package that defines them:

```typescript
// Access hook: load data before the page renders
onAccess: [
  access({
    effects: [MyEffects.LoadCaseData(Params('caseId'))],
  }),
]

// Submit hook: handle an in-page lookup
onSubmission: [
  submit({
    when: Post('action').match(Condition.Equals('lookup')),
    validate: false,
    onAlways: {
      effects: [MyEffects.LookupPostcode(Post('postcode'))],
    },
  }),
]

// Submit hook: save on valid submission
onSubmission: [
  submit({
    validate: true,
    onValid: {
      effects: [MyEffects.SaveAnswers()],
      next: [redirect({ goto: 'next-step' })],
    },
  }),
]
```

Effects can be combined freely. A load-then-save pattern in a submit
hook might look like this:

```typescript
submit({
  validate: true,
  onValid: {
    effects: [
      MyEffects.SaveAnswers(),
      MyEffects.SendConfirmationEmail(),
    ],
    next: [redirect({ goto: 'confirmation' })],
  },
})
```

---

## Custom effects

Every effect in a journey is custom. Forge does not ship a built-in
library of effects because the work they do is application-specific:
which API to call, which data store to write to, which audit events
to send. You define the effects your application needs and register
them in its package.

See [Building custom effects](../building-functions-and-components/custom-effects)
for the shape interface, implementation, context API, typed
contexts, and registration details.

---

## Best practices

- **Keep effects focused.** Each effect should do one thing: load
  data, save answers, call an API. Compose multiple effects in a
  hook's `effects` array rather than building one large effect that
  does everything.
- **Pass dynamic values as arguments.** When an effect needs a value
  from the request, pass it through the definition as an expression
  (`Params('caseId')`, `Answer('reference')`). This keeps the effect
  reusable across callers.
- **Use `Data()` for values blocks need.** Data set by an effect is
  available through `Data()` references for the rest of the request,
  so blocks can declare what they need without knowing where it came
  from.
