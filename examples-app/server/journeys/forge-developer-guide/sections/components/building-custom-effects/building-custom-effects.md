---
title: Custom effects
section: building-functions-and-components
path: building-functions-and-components/custom-effects
teaches: [defineEffectFunctions, EffectFunctionExpr, EffectFunctionContext, custom-effect-shape, effect-implementation, typed-context]
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

## The shape interface

The shape interface defines what each effect looks like in a
journey definition. Each property is a function that returns an
`EffectFunctionExpr`:

```typescript
import { EffectFunctionExpr } from '@ministryofjustice/hmpps-forge/core/authoring'

export interface MyEffectShape {
  /**
   * Loads case data from the API and sets it on the data context.
   * @param caseId - The unique identifier of the case to load.
   */
  LoadCaseData: (caseId: string) => EffectFunctionExpr
  /** Persists all current answers to the data store. */
  SaveAnswers: () => EffectFunctionExpr
  /** Collects trip field answers into a structured object and appends it to the trips array. */
  AddTrip: () => EffectFunctionExpr
  /**
   * Removes a trip from the trips array by its position.
   * @param index - The zero-based index of the trip to remove.
   */
  RemoveTrip: (index: number) => EffectFunctionExpr
}
```

Arguments declared in the shape are expressions in the journey
definition that Forge resolves before calling the effect:

```typescript
access({
  effects: [MyEffects.LoadCaseData(Params('caseId'))],
})
```

When the hook runs, Forge resolves `Params('caseId')` to the
actual value from the URL and passes it to the effect function.

---

## The implementation

`defineEffectFunctions` pairs the shape with implementations. Each
implementation follows the pattern
`(deps) => (context, ...args) => Promise<void> | void`:

```typescript
import { defineEffectFunctions } from '@ministryofjustice/hmpps-forge/core/authoring'

export const { effects: MyEffects, implementations: myEffectImplementations } =
  defineEffectFunctions<MyEffectShape, MyDeps>({
    LoadCaseData: (deps) => async (context, caseId: string) => {
      const caseData = await deps.caseApi.getCase(caseId)

      context.setData('case', caseData)
    },

    SaveAnswers: (deps) => async (context) => {
      const sessionId = context.getSession().id
      const answers = context.getAllAnswers()

      await deps.formDataStore.save(sessionId, answers)
    },

    AddTrip: (deps) => async (context) => {
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
    },

    RemoveTrip: (deps) => async (context, index: number) => {
      const trips = context.getAnswer('trips') ?? []
      context.setAnswer('trips', trips.filter((_, i) => i !== index))
    },
  })
```

The call returns two things:

- **`effects`** (here `MyEffects`) is a builder object for use in
  journey definitions. `MyEffects.LoadCaseData(Params('caseId'))`
  creates an effect expression that Forge runs inside a hook.
- **`implementations`** (here `myEffectImplementations`) is an
  object containing the actual functions, ready to be registered in
  a package.

---

## Author-time preparation

Factory entries can also be written as `{ prepare, factory }`,
where `prepare` is an optional hook that runs synchronously when
the effect builder is called. Use it to sanitise or reshape
arguments before they enter the expression tree, and to reject
invalid arguments early — when the journey module loads rather
than at render time.

`prepare` receives only the arguments the author passed to the
builder and returns them as an array. The returned array replaces
the original arguments in the built expression.

```typescript
export const { effects: MyEffects, implementations: myEffectImplementations } =
  defineEffectFunctions<MyEffectShape, MyDeps>({
    RemoveTrip: {
      prepare: (index: number): [number] => {
        if (!Number.isInteger(index) || index < 0) {
          throw new Error('RemoveTrip requires a non-negative integer index')
        }

        return [index]
      },
      factory: (deps) => async (context, index: number) => {
        const trips = context.getAnswer('trips') ?? []
        context.setAnswer('trips', trips.filter((_, i) => i !== index))
      },
    },
  })
```

A bad call fails as soon as the definition is imported:

```typescript
// Throws 'RemoveTrip requires a non-negative integer index'.
MyEffects.RemoveTrip(-1)
```

`prepare` does not see injected dependencies or the runtime
context, so it can only check structural properties of the
arguments: required fields, numeric ranges, enum membership, or
combinations of arguments. Checks that depend on the context
belong inside the evaluator.

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
context.getAnswer('email')           // get a single answer
context.setAnswer('email', value)    // set a single answer
context.getAllAnswers()               // get all answers as an object
context.hasAnswer('email')           // check if an answer exists
```

`setAnswer` is how effects modify user state. Setting an answer
changes what the field displays on the next render and what gets
submitted on the next POST.

### Data

Set values for `Data()` references:

```typescript
context.setData('availableSlots', slots)
context.setData('case', caseData)
```

Values set through `setData` are available through `Data()` for
the rest of the current request. They are not persisted between
requests. If a value needs to survive across page loads, store it
in answers or in an external data store.

### Request

Read information from the current request:

```typescript
context.getParams()     // route parameters (e.g. { caseId: '123' })
context.getQuery()      // query string parameters
context.getPost()       // POST body values
context.getSession()    // session data
```

These are read-only views of the request. To act on them, use the
answers and data methods above.

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

Then use the type on your implementations:

```typescript
SaveAnswers: (deps) => async (context: MyContext) => {
  const name = context.getAnswer('fullName')        // typed as string
  const method = context.getAnswer('contactMethod')  // typed as 'email' | 'phone' | 'text'
  const session = context.getSession()               // typed as MySession
}
```

The answer interfaces must extend `Record<string, unknown>` so
Forge can handle answers that are not explicitly declared in the
type.

---

## Async patterns

Effects can be synchronous or asynchronous. Most real effects are
async because they interact with external services:

```typescript
LoadCaseData: (deps) => async (context, caseId: string) => {
  const caseData = await deps.caseApi.getCase(caseId)
  context.setData('case', caseData)
}
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

Effect implementations are registered in a package through the
`functions` property:

```typescript
import { createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'

export default createForgePackage<MyDeps>({
  journey: myJourney,
  functions: {
    ...myEffectImplementations,
  },
})
```

Dependencies are injected at application startup:

```typescript
forge.registerPackage(myPackage, {
  caseApi: services.caseApi,
  formDataStore: services.formDataStore,
})
```

Every effect in the package receives these dependencies as its
outer function argument. This keeps effects decoupled from service
construction and makes them straightforward to test.

---

## Common patterns

### Loading and saving answers

The most common pair of effects. Load answers from a data store on
access, save them on submission:

```typescript
LoadAnswers: (deps) => async (context) => {
  const sessionId = context.getSession().id
  const saved = await deps.store.get(sessionId)

  if (saved) {
    for (const [code, value] of Object.entries(saved)) {
      if (!context.hasAnswer(code)) {
        context.setAnswer(code, value)
      }
    }
  }
},

SaveAnswers: (deps) => async (context) => {
  const sessionId = context.getSession().id
  const answers = context.getAllAnswers()

  await deps.store.save(sessionId, answers)
},
```

The `hasAnswer` check in `LoadAnswers` avoids overwriting values
the user has just submitted. Without it, a POST request would load
old saved values on top of the new submission.

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

Blocks reference `Data('availableSlots')` without knowing where
the data came from.

### Collecting fields into a structure

Gather individual field answers into a structured object and
append it to an array:

```typescript
AddTrip: (deps) => async (context) => {
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
},
```

---

## Testing

Effects are the most involved function type to test because of the
context object. Create a mock context with the methods your effect
uses:

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

      const loadCaseData = myEffectImplementations.LoadCaseData(deps)

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

      const addTrip = myEffectImplementations.AddTrip({} as MyDeps)

      // Act
      await addTrip(context)

      // Assert
      expect(answers.trips).toHaveLength(2)
      expect(answers.tripCountry).toBeUndefined()
    })
  })
})
```

For effects with many context interactions, a helper function that
builds a mock context from an initial state can reduce boilerplate
across tests.

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
- **Prepare arguments at author time.** Use the
  `{ prepare, factory }` form to sanitise arguments and catch
  configuration errors at module load rather than at render time.
