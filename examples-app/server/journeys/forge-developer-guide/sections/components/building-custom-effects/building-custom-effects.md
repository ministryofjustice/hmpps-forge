---
title: Custom effects
section: building-functions-and-components
path: building-functions-and-components/custom-effects
teaches: [EffectRegistry, register, EffectFunctionContext, effect-implementation, typed-context]
prerequisites: [onAccess, onSubmission, access, submit, Data, Answer, createForgePackage]
---

<p class="govuk-caption-xl">Functions</p>

# Building custom effects

Effects are where your application logic lives. They load data from
APIs, save answers to a data store, send audit events, manage
collections, and handle anything else that reaches beyond the
declarative definition. Forge provides the lifecycle hooks that
decide *when* effects run. You provide the implementations that
decide *what* they do.

{{slot:toc}}

---

## Declaring effects

Custom effects are declared through an `EffectRegistry`. You create
one registry, register each effect on it, and group the returned
handles in a plain object for use in journey definitions. Each
factory follows the pattern
`(deps) => (context, ...args) => Promise<void> | void`:

```typescript
import { EffectRegistry } from '@ministryofjustice/hmpps-forge/core/authoring'

const myEffects = new EffectRegistry<MyDeps>()

export const MyEffects = {
  /**
   * Loads case data from the API and sets it on the data context.
   * @param caseId - The unique identifier of the case to load.
   */
  LoadCaseData: myEffects.register(
    'LoadCaseData',
    (deps) => async (context, caseId: string) => {
      const caseData = await deps.caseApi.getCase(caseId)

      context.setData('case', caseData)
    },
  ),

  /** Persists all current answers to the data store. */
  SaveAnswers: myEffects.register('SaveAnswers', (deps) => async (context) => {
    const sessionId = context.getSession().id
    const answers = context.getAllAnswers()

    await deps.formDataStore.save(sessionId, answers)
  }),

  /** Collects trip field answers into a structured object and appends it to the trips array. */
  AddTrip: myEffects.register('AddTrip', (deps) => async (context) => {
    const trip = {
      country: context.getAnswer('tripCountry'),
      departureDate: context.getAnswer('tripDepartureDate'),
      returnDate: context.getAnswer('tripReturnDate'),
      reason: context.getAnswer('tripReason'),
    }

    const trips = context.getAnswer('trips') ?? []
    context.setAnswer('trips', [...trips, trip])

    context.setAnswer('tripCountry', undefined)
    context.setAnswer('tripDepartureDate', undefined)
    context.setAnswer('tripReturnDate', undefined)
    context.setAnswer('tripReason', undefined)
  }),

  /**
   * Removes a trip from the trips array by its position.
   * @param index - The zero-based index of the trip to remove.
   */
  RemoveTrip: myEffects.register('RemoveTrip', (deps) => async (context, index: number) => {
    const trips = context.getAnswer('trips') ?? []
    context.setAnswer('trips', trips.filter((_, i) => i !== index))
  }),
}
```

There is no separate shape interface to maintain. `register` infers
the argument types straight from the factory, so
`MyEffects.LoadCaseData` becomes
`(caseId: string) => EffectFunctionExpr` and `MyEffects.SaveAnswers`
becomes `() => EffectFunctionExpr`. The JSDoc on each grouped handle
documents the effect the same way a shape interface used to.

`MyEffects.LoadCaseData(Params('caseId'))` creates an effect
expression that Forge runs inside a hook. Arguments passed to a
handle are expressions that Forge resolves before calling the
effect:

```typescript
access({
  effects: [MyEffects.LoadCaseData(Params('caseId'))],
})
```

When the hook runs, Forge resolves `Params('caseId')` to the
actual value from the URL and passes it to the effect function.

The handle's signature is inferred from the factory, so a factory
that declares `caseId: string` produces a handle that only accepts
a string at the type level. To accept expressions too, widen the
parameter to `string | ResolvableValue` (exported from
`@ministryofjustice/hmpps-forge/core/authoring`). Forge resolves
the expression before the effect runs.

---

## Author-time preparation

The `register` options object accepts a `prepare` hook that runs
synchronously when the effect handle is called. Use it to sanitise
or reshape arguments before they enter the expression tree, and to
reject invalid arguments early — when the journey module loads
rather than at render time.

`prepare` receives only the arguments the author passed to the
handle and returns them as an array. The returned array replaces
the original arguments in the built expression.

```typescript
const myEffects = new EffectRegistry<MyDeps>()

export const MyEffects = {
  RemoveTrip: myEffects.register(
    'RemoveTrip',
    {
      prepare: (index: number): [number] => {
        if (!Number.isInteger(index) || index < 0) {
          throw new Error('RemoveTrip requires a non-negative integer index')
        }

        return [index]
      },
    },
    (deps) => async (context, index: number) => {
      const trips = context.getAnswer('trips') ?? []
      context.setAnswer('trips', trips.filter((_, i) => i !== index))
    },
  ),
}
```

A bad call fails as soon as the definition is imported:

```typescript
// Throws 'RemoveTrip requires a non-negative integer index'.
MyEffects.RemoveTrip(-1)
```

`prepare` does not see injected dependencies or the runtime
context, so it can only check structural properties of the
arguments: required fields, numeric ranges, enum membership, or
combinations of arguments. Checks that depend on the context belong
inside the evaluator. The options object also accepts an
`argumentsSchema` (a `z.tuple`) when you only need to validate the
arguments without reshaping them — note it runs at request time,
each time the effect is evaluated, whereas `prepare` runs once at
module load.

Argument-count mismatches against a tuple schema are additionally caught at `registerPackage()` by semantic analysis, so a call with the wrong number of arguments fails compilation instead of waiting for request time.

If an argument is itself an expression like `Params('caseId')`, its
resolved value is not available at author time. Validate the
resolved value inside the evaluator instead.

---

## The effect context

Unlike transformers, generators, and conditions, effects receive a
context object as their first parameter. This context gives them
read and write access to the current request's state.

### Answers

Read and write field values:

```typescript
context.getAnswer('email')          // get a single answer
context.getAnswer<string>('email')  // get a single answer with a local type hint
context.setAnswer('email', value)   // set a single answer
context.getAllAnswers()             // get all answers as an object
context.getAnswerHistory('email')   // get mutation history for one answer
context.getAllAnswerHistories()     // get mutation history for all answers
context.hasAnswer('email')          // check if an answer exists
context.clearAnswer('email')        // remove an answer
```

`setAnswer` is how effects modify user state. Setting an answer
changes what the field displays on the next render and what gets
submitted on the next POST.

### Data

Set values for `Data()` references:

```typescript
context.getData<Slot[]>('availableSlots')
context.setData('availableSlots', slots)
context.setData('case', caseData)
context.getAllData()
```

Values set through `setData` are available through `Data()` for
the rest of the current request. They are not persisted between
requests. If a value needs to survive across page loads, store it
in answers or in an external data store.

### Request

Read information from the current request:

```typescript
context.getRequestUrl()            // full request URL
context.getRequestParam('caseId')  // single route parameter
context.getAllRequestParams()      // all route parameters
context.getQueryParam('page')      // single query string parameter
context.getAllQueryParams()        // all query string parameters
context.getPostData('action')      // single raw POST body value
context.getPostData<string>('action')
context.getAllPostData()           // all raw POST body values
context.getSession()               // session data
context.getState('user')           // custom request state
context.getAllState()              // all custom request state
```

These are read-only views of the request. To act on them, use the
answers and data methods above.

Request state is supplied by the framework adapter. In the
Express-Nunjucks adapter, it is merged from `app.locals`,
`res.locals`, and `req.state`, with `req.state` taking priority.
Set values in upstream Express middleware when an effect needs to
read them through `getState`.

`getAnswer`, `getData`, `getPostData`, and `getAllPostData`
accept call-level generic type hints. These are TypeScript hints
only. They do not validate external request data at runtime, so
check values from POST data before using them.

### Headers and cookies

Read request headers and cookies:

```typescript
context.getRequestHeader('accept')
context.getAllRequestHeaders()
context.getRequestCookie('session')
context.getAllRequestCookies()
```

Set response headers and cookies through the framework adapter:

```typescript
context.setResponseHeader('cache-control', 'no-store')
context.setResponseCookie('preference', 'compact', { httpOnly: true })
```

These are write-only. There are no matching getters for response
headers or cookies, the values go straight to the framework adapter.

### Reachability

```typescript
context.getFieldsToClear()
```

Returns answer keys from fields that are no longer reachable due
to conditional logic (for example, a phone number field that was
hidden because the user changed their contact method to email).
This is useful for effects that persist answers and need to clear
stale values.

---

## Typed contexts

You can type the context to get full type safety on answers and
session data. Define interfaces for your answer and session shapes,
then create a type alias using `EffectFunctionContext`:

```typescript
import { EffectFunctionContext } from '@ministryofjustice/hmpps-forge/core/authoring'

interface MyAnswers extends Record<string, unknown> {
  fullName: string
  email: string
  contactMethod: 'email' | 'phone' | 'text'
  trips: Trip[]
}

interface MySession {
  id: string
  userId: string
}

type MyContext = EffectFunctionContext<Record<string, unknown>, MyAnswers, MySession>
```

Then use the type on your effect factories:

```typescript
SaveAnswers: myEffects.register('SaveAnswers', (deps) => async (context: MyContext) => {
  const name = context.getAnswer('fullName')        // typed as string
  const method = context.getAnswer('contactMethod')  // typed as 'email' | 'phone' | 'text'
  const session = context.getSession()               // typed as MySession | undefined
}),
```

The answer interfaces must extend `Record<string, unknown>` so
Forge can handle answers that are not explicitly declared in the
type.

If you are not using a typed context alias, you can type individual
reads at the call site:

```typescript
const name = context.getAnswer<string>('fullName')
const availableSlots = context.getData<Slot[]>('availableSlots')
const action = context.getPostData<string>('action')
const postData = context.getAllPostData<{ action?: string }>()
```

---

## Async patterns

Effects can be synchronous or asynchronous. Most real effects are
async because they interact with external services:

```typescript
LoadCaseData: myEffects.register('LoadCaseData', (deps) => async (context, caseId: string) => {
  const caseData = await deps.caseApi.getCase(caseId)
  context.setData('case', caseData)
}),
```

When multiple effects appear in the same hook, they run in
sequence. Each one completes before the next starts:

```typescript
onAccess: [
  access({
    effects: [
      MyEffects.LoadCaseData(Params('caseId')),
      MyEffects.LoadAppointmentSlots(),
    ],
  }),
]
```

Here `LoadCaseData` finishes before `LoadAppointmentSlots` begins.
If the second effect depends on data loaded by the first, this
ordering is guaranteed.

---

## Registration

Pass the registry to a package through the `functions` property:

```typescript
import { createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'

export default createForgePackage<MyDeps>({
  journey: myJourney,
  functions: myEffects,
})
```

`functions` also accepts an array of registries when a package
mixes effects with conditions, transformers, or generators:

```typescript
functions: [myEffects, myConditions],
```

Dependencies are injected at application startup:

```typescript
forge.registerPackage(myPackage, {
  caseApi: services.caseApi,
  formDataStore: services.formDataStore,
})
```

Every effect in the registry receives these dependencies as its
outer function argument. This keeps effects decoupled from service
construction and makes them straightforward to test. To make
effects available to every journey rather than a single package,
register the registry globally instead:

```typescript
forge.registerGlobalFunctions(myEffects, {
  caseApi: services.caseApi,
  formDataStore: services.formDataStore,
})
```

---

## Common patterns

### Loading and saving answers

The most common pair of effects. Load answers from a data store on
access, save them on submission:

```typescript
LoadAnswers: myEffects.register('LoadAnswers', (deps) => async (context) => {
  const sessionId = context.getSession().id
  const saved = await deps.store.get(sessionId)

  if (saved) {
    for (const [code, value] of Object.entries(saved)) {
      if (!context.hasAnswer(code)) {
        context.setAnswer(code, value)
      }
    }
  }
}),

SaveAnswers: myEffects.register('SaveAnswers', (deps) => async (context) => {
  const sessionId = context.getSession().id
  const answers = context.getAllAnswers()

  await deps.store.save(sessionId, answers)
}),
```

The `hasAnswer` check in `LoadAnswers` avoids overwriting values
the user has just submitted. Without it, a POST request would load
old saved values on top of the new submission.

### Loading data for display

Load from an API and expose through `Data()`:

```typescript
LoadAppointmentSlots: myEffects.register('LoadAppointmentSlots', (deps) => async (context) => {
  const date = context.getAnswer('appointmentDate')
  const type = context.getAnswer('appointmentType')
  const slots = await deps.appointmentApi.getSlots(type, date)

  context.setData('availableSlots', slots)
}),
```

Blocks reference `Data('availableSlots')` without knowing where
the data came from.

### Collecting fields into a structure

Gather individual field answers into a structured object and
append it to an array:

```typescript
AddTrip: myEffects.register('AddTrip', (deps) => async (context) => {
  const trip = {
    country: context.getAnswer('tripCountry'),
    departureDate: context.getAnswer('tripDepartureDate'),
    returnDate: context.getAnswer('tripReturnDate'),
  }

  const trips = context.getAnswer('trips') ?? []
  context.setAnswer('trips', [...trips, trip])

  // Clear the temporary fields
  context.setAnswer('tripCountry', undefined)
  context.setAnswer('tripDepartureDate', undefined)
  context.setAnswer('tripReturnDate', undefined)
}),
```

---

## Testing

`register` returns an expression handle, not the underlying
function, so tests evaluate the effect through the registry's
`build` method. Call `build` with mock dependencies to get an
object keyed by name, then read the `evaluate` function and call it
with a mock context:

```typescript
describe('MyEffects', () => {
  describe('LoadCaseData', () => {
    it('should load case data and set it on the context', async () => {
      // Arrange
      const caseData = { id: '123', name: 'Test case' }
      const deps = {
        caseApi: { getCase: jest.fn().mockResolvedValue(caseData) },
      } as unknown as MyDeps

      const context = {
        setData: jest.fn(),
      } as unknown as EffectFunctionContext

      const loadCaseData = myEffects.build(deps).LoadCaseData.evaluate

      // Act
      await loadCaseData(context, '123')

      // Assert
      expect(deps.caseApi.getCase).toHaveBeenCalledWith('123')
      expect(context.setData).toHaveBeenCalledWith('case', caseData)
    })
  })

  describe('AddTrip', () => {
    it('should append a trip and clear temporary fields', async () => {
      // Arrange
      const answers: Record<string, unknown> = {
        tripCountry: 'France',
        tripDepartureDate: '2026-06-01',
        tripReturnDate: '2026-06-14',
        trips: [{ country: 'Spain', departureDate: '2026-01-01', returnDate: '2026-01-07' }],
      }

      const context = {
        getAnswer: jest.fn((code: string) => answers[code]),
        setAnswer: jest.fn((code: string, value: unknown) => { answers[code] = value }),
      } as unknown as EffectFunctionContext

      const addTrip = myEffects.build({} as MyDeps).AddTrip.evaluate

      // Act
      await addTrip(context)

      // Assert
      expect(answers.trips).toHaveLength(2)
      expect(answers.tripCountry).toBeUndefined()
    })
  })
})
```

`build` returns the entry keyed by the name you registered, and
`evaluate` is the `(context, ...args) => Promise<void>` function
itself. For effects with many context interactions, a helper
function that builds a mock context from an initial state can reduce
boilerplate across tests.

---

## Best practices

- **Keep effects focused.** Each effect should do one thing: load
  data, save answers, call an API. Compose multiple effects in a
  hook's `effects` array rather than building one large effect that
  does everything.
- **Use `context.hasAnswer()` before overwriting.** When loading
  saved answers, check if the user has already entered a value to
  avoid overwriting their input.
- **Use `context.setData()` for values blocks need.** Data set by
  effects is available through `Data()` references for the rest of
  the request.
- **Inject dependencies, do not import services directly.** The
  `(deps) => ...` pattern keeps effects testable and decoupled from
  how services are constructed.
- **Handle errors at the right level.** If an API call fails, let
  the error propagate so Forge's error handling can catch it. Only
  catch errors when you need to transform them into a different
  outcome (for example, setting a "not found" flag on the data
  context).
- **Validate arguments early.** Use a `prepare` hook to catch
  configuration errors at module load, or an `argumentsSchema` to
  catch them at request time before the evaluator runs.
