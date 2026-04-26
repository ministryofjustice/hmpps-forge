---
title: Data
section: authoring-language
path: authoring-language/data
teaches: [Data, data-property, setData, static-data, dynamic-data]
prerequisites: [step, StepDefinition, journey, JourneyDefinition, onAccess]
---

<p class="govuk-caption-xl">References</p>

# Data

`Answer()` references what users have entered. `Data()` references
everything else: reference lists, API responses, configuration,
computed values. It's how you bring external information into your
definitions without hard-coding it.

{{slot:toc}}

---

## What is Data?

Data in Forge comes from two places. You can attach it directly to a
step or journey definition through the `data` property, or you can
set it at runtime through effect functions using `context.setData()`.
Either way, you access it with `Data()`.

### Static data

A list of countries that never changes is a good example of static
data. Attach it to the step and reference it in a block:

```typescript
import { countries } from './countries'

const addTripStep = step({
  path: '/add-trip',
  title: 'Add a trip',
  data: { countries },
  blocks: [countryField, continueButton],
})
```

```typescript
GovUKSelectInput({
  code: 'tripCountry',
  label: { text: 'Which country did you visit?' },
  items: Data('countries').each(
    Iterator.Map({
      value: Item().path('value'),
      text: Item().path('text'),
    }),
  ),
})
```

`Data('countries')` resolves to the array attached to the step. The
block does not need to know where the list came from or how it was
built. It just declares what it needs and Forge provides it.

### Dynamic data

When data comes from an API or needs to be computed at runtime, an
effect function loads it and stores it with `context.setData()`. The
block definition looks the same:

```typescript
// In the step definition
const timeStep = step({
  path: '/choose-time',
  title: 'Choose a time',
  onAccess: [
    access({
      effects: [MyEffects.LoadAppointmentSlots()],
    }),
  ],
  blocks: [appointmentTimeField, continueButton],
})
```

```typescript
// In the effect implementation
LoadAppointmentSlots: (deps) => async (context) => {
  const date = context.getAnswer('appointmentDate')
  const type = context.getAnswer('appointmentType')
  const slots = await deps.appointmentApi.getSlots(type, date)

  context.setData('availableSlots', slots)
}
```

```typescript
// In the block definition
GovUKSelectInput({
  code: 'appointmentTime',
  label: { text: 'Choose a time' },
  items: Data('availableSlots').each(
    Iterator.Map({
      value: Item().path('time'),
      text: Item().path('time'),
    }),
  ),
})
```

The block references `Data('availableSlots')` the same way it would
reference static data. It does not know or care that an effect loaded
this from an API. This is the key benefit: **block definitions stay
declarative regardless of where their data comes from.**

---

## How it works

When Forge evaluates a `Data()` reference, it looks up the key in
the current data context. This context is built from two sources, in
order:

1. Static `data` properties from the journey and step definitions,
   merged together (step values take precedence when keys overlap).
2. Values set by effect functions through `context.setData()` during
   the current request.

If an effect sets a key that also exists in the static data, the
effect's value wins for that request.

### Data inheritance

Data flows downward through the journey hierarchy. A journey's `data`
is available to all its steps and child journeys. Steps can add their
own data, which merges with the inherited values:

```typescript
journey({
  path: '/travel-declaration',
  data: {
    maxTrips: 10,
    supportEmail: 'travel@example.com',
  },
  steps: [
    step({
      path: '/add-trip',
      data: { countries },  // merged with journey data
      blocks: [...],
    }),
  ],
})
```

Inside the add-trip step, `Data('countries')`, `Data('maxTrips')`,
and `Data('supportEmail')` all resolve. The step sees both its own
data and the data inherited from its parent journey.

---

## Using Data in conditions and hooks

`Data()` works in conditions the same way `Answer()` does. An access
hook might load data from an API, then check the result before
allowing the step to render:

```typescript
onAccess: [
  access({
    effects: [MyEffects.LoadCaseData(Params('caseId'))],
    next: [
      throwError({
        when: Data('case').not.match(Condition.IsRequired()),
        status: 404,
        message: 'Case not found',
      }),
      redirect({
        when: Data('case.isReadOnly').match(Condition.Equals(true)),
        goto: '/overview',
      }),
    ],
  }),
]
```

Effects run before `next` outcomes are evaluated, so the data is
available for the conditions to test. This pattern of "load then
check" is covered in detail in
[Loading, saving and redirecting](../building-journeys/loading-saving-and-redirecting).

Data can also drive redirect paths dynamically:

```typescript
redirect({ goto: Data('redirectPath') })
```

---

## Nested values

Like `Answer()`, `Data()` supports dot notation for reaching into
nested objects:

```typescript
Data('case.isReadOnly')
Data('session.caseDetails.givenName')
```

Forge splits the string on dots and walks the resulting path. The
`.path()` method works the same way and can be chained:

```typescript
Data('session').path('caseDetails').path('givenName')
```

---

## API surface

### `Data(key)`

Creates a reference to a value in the current data context.

```typescript
import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
```

`key` is a string, with optional dot notation for nested access.

Returns a chainable reference that supports `.path()`, `.match()`,
`.pipe()`, and `.each()`.

### `.path(key)`

Navigates to a nested property within the referenced value. Supports
dot notation and can be chained.

```typescript
Data('session').path('caseDetails.givenName')
```

---

## Best practices

- **Use static `data` for values that do not change.** Country lists,
  configuration constants, enum options. These belong on the step or
  journey definition, not in an effect.
- **Use `context.setData()` for values loaded at runtime.** API
  responses, computed values, anything that depends on the current
  request or user state.
- **Set shared data at the journey level.** If every step needs the
  same configuration or reference data, set it once on the journey
  rather than repeating it on each step.
- **Keep data keys short and descriptive.** `Data('countries')` is
  clear. `Data('staticReferenceDataCountryList')` is not.
- **Prefer `Data()` over `Answer()` for non-field values.** If a
  value was not entered by the user in a field, it belongs in the
  data context, not the answer context. This keeps the two contexts
  semantically distinct.
