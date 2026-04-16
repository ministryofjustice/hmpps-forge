---
title: Effects
section: authoring-language
path: authoring-language/effects
teaches: [effects, defineEffectFunctions, EffectFunctionContext, context-api, dependency-injection]
prerequisites: [onAccess, onAction, onSubmission, access, action, submit, Data, Answer]
---

<p class="govuk-caption-xl">Functions</p>

# Effects

Effects are where your application logic lives. They run inside
hooks and are the bridge between Forge's declarative definitions
and the outside world: loading data from APIs, saving answers to a
data store, sending audit events, or anything else your service
needs. Forge orchestrates when they run; you decide what they do.

{{slot:toc}}

---

## What is an effect?

Conditions, transformers, and generators are all pure functions.
They take a value and return a result without touching anything
outside the expression system. Effects are different. They have
access to a context object that lets them read and write answers,
set data, access the session, and call external services through
injected dependencies.

```typescript
import {
  defineEffectFunctions,
  EffectFunctionExpr,
} from '@ministryofjustice/hmpps-forge/core/authoring'

export interface MyEffectShape {
  LoadAppointmentSlots: () => EffectFunctionExpr
}

export const { effects: MyEffects, implementations: myEffectImplementations } =
  defineEffectFunctions<MyEffectShape, MyDeps>({
    LoadAppointmentSlots: (deps) => async (context) => {
      const date = context.getAnswer('appointmentDate')
      const type = context.getAnswer('appointmentType')
      const slots = await deps.appointmentApi.getSlots(type, date)

      context.setData('availableSlots', slots)
    },
  })
```

Effects follow the `(deps) => (context, ...args) => ...` pattern.
The outer function receives injected dependencies. The inner
function receives the effect context and any arguments declared in
the shape interface. This separation keeps your journey definitions
free of direct service references and makes effects straightforward
to test.

---

## How it works

### The effect context

Every effect receives a context object that provides access to the
current request's state. The key methods are:

**Answers** - read and write field values:

- `context.getAnswer(code)` - get a single answer
- `context.setAnswer(code, value)` - set a single answer
- `context.getAllAnswers()` - get all answers as an object
- `context.hasAnswer(code)` - check if an answer exists

**Data** - set values for `Data()` references:

- `context.setData(key, value)` - make a value available through
  `Data(key)` for the current request

**Request** - read request information:

- `context.getParams()` - route parameters
- `context.getQuery()` - query string parameters
- `context.getPost()` - POST body values
- `context.getSession()` - session data

**Reachability** - manage field cleardown:

- `context.getFieldsToClear()` - answer keys from unreachable steps

### Arguments from the definition

Effects can accept arguments declared in the shape interface. These
arguments are expressions in the journey definition that Forge
resolves before calling the effect:

```typescript
export interface MyEffectShape {
  LoadCaseData: (caseId: string) => EffectFunctionExpr
}
```

```typescript
// In the journey definition
access({
  effects: [MyEffects.LoadCaseData(Params('caseId'))],
})
```

When the hook runs, Forge resolves `Params('caseId')` to the actual
value from the URL, then passes it to the effect function.

### Dependency injection

Dependencies are injected when you register the package:

```typescript
forge.registerPackage(myPackage, {
  appointmentApi: services.appointmentApi,
  formDataStore: services.formDataStore,
})
```

Every effect in the package receives these dependencies as its
first argument. This keeps effects decoupled from service
construction and makes them easy to test with stubs or mocks.

---

## Using in your definitions

Effects are referenced in hooks using the effect builders produced
by `defineEffectFunctions`:

```typescript
// Access hook: load data before the page renders
onAccess: [
  access({
    effects: [MyEffects.LoadCaseData(Params('caseId'))],
  }),
]

// Action hook: handle an in-page lookup
onAction: [
  action({
    when: Post('action').match(Condition.Equals('lookup')),
    effects: [MyEffects.LookupPostcode(Post('postcode'))],
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

Multiple effects in the same array run in sequence. Each one
completes before the next starts.

---

## Common patterns

### Loading and saving answers

The most common effects load answers from a data store on access
and save them on submission:

```typescript
LoadAnswers: (deps) => async (context) => {
  const sessionId = context.getSession().id
  const savedAnswers = await deps.store.get(sessionId, formCode)

  if (savedAnswers) {
    for (const [code, value] of Object.entries(savedAnswers)) {
      if (!context.hasAnswer(code)) {
        context.setAnswer(code, value)
      }
    }
  }
},

SaveAnswers: (deps) => async (context) => {
  const sessionId = context.getSession().id
  const answers = context.getAllAnswers()
  await deps.store.set(sessionId, formCode, answers)
},
```

### Loading data for display

Load from an API and expose through `Data()`:

```typescript
LoadAppointmentSlots: (deps) => async (context) => {
  const date = context.getAnswer('appointmentDate')
  const type = context.getAnswer('appointmentType')
  const slots = await deps.appointmentApi.getSlots(type, date)

  context.setData('availableSlots', slots)
},
```

The blocks can then reference `Data('availableSlots')` without
knowing how the data was fetched.

### Collecting fields into a structure

Gather individual field answers into a structured object:

```typescript
AddTrip: (deps) => async (context) => {
  const trip = {
    country: context.getAnswer('tripCountry'),
    departureDate: context.getAnswer('tripDepartureDate'),
    returnDate: context.getAnswer('tripReturnDate'),
    reason: context.getAnswer('tripReason'),
  }

  const trips = context.getAnswer('trips') ?? []
  context.setAnswer('trips', [...trips, trip])
},
```

---

## Typed context

You can type the context to get full type safety on answers,
session data, and dependencies:

```typescript
import { EffectFunctionContext } from '@ministryofjustice/hmpps-forge/core/authoring'

interface MyAnswers extends Record<string, unknown> {
  fullName: string
  email: string
  contactMethod: 'email' | 'phone' | 'text'
}

interface MySession {
  id: string
}

type MyContext = EffectFunctionContext<Record<string, unknown>, MyAnswers, MySession>
```

Then use it in your effect implementations:

```typescript
SaveAnswers: (deps: MyDeps) => async (context: MyContext) => {
  context.getAnswer('fullName')       // typed as string
  context.getAnswer('contactMethod')  // typed as 'email' | 'phone' | 'text'
  context.getSession().id             // typed as string
}
```

---

## API surface

### `defineEffectFunctions(implementations)`

Defines effect functions. Returns an `effects` object for use in
journey definitions and an `implementations` object for registration
in a package.

```typescript
import { defineEffectFunctions } from '@ministryofjustice/hmpps-forge/core/authoring'
```

The implementation signature is `(deps) => (context, ...args) => Promise<void> | void`.

---

## Best practices

- **Keep effects focused.** Each effect should do one thing: load
  data, save answers, call an API. Compose multiple effects in a
  hook's `effects` array rather than building one large effect that
  does everything.
- **Use `context.setData()` for values blocks need.** Data set by
  effects is available through `Data()` references for the rest of
  the request.
- **Use `context.hasAnswer()` before overwriting.** When loading
  saved answers, check if the user has already entered a value on
  the current request to avoid overwriting their input.
- **Register implementations in the package.** Like conditions,
  transformers, and generators, effect implementations are scoped
  to the package that registers them.
- **Inject dependencies, do not import services directly.** The
  `(deps) => ...` pattern keeps effects testable and decoupled from
  service construction.
