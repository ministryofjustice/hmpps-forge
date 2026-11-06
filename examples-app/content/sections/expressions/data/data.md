---
title: Data
section: authoring-language
path: authoring-language/data
teaches: [data, data-property, setData, static-data, dynamic-data]
prerequisites: [step, StepDefinition, journey, JourneyDefinition, onAccess]
---

<p class="govuk-caption-xl">References</p>

# Data

`answer()` references what users have entered. `data()` references
everything else: reference lists, API responses, configuration,
computed values. It's how you bring external information into your
definitions without hard-coding it.

{{slot:toc}}

---

## What is Data?

Data in Forge comes from two places. You can attach it directly to a
step or journey definition through the `data` property, or you can
set it at runtime through effect functions using `context.set_data()`.
Either way, you access it with `data()`.

### Static data

A list of countries that never changes is a good example of static
data. Attach it to the step and reference it in a block:

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};

let add_trip_step = step(obj! {
    "path": "/add-trip",
    "title": "Add a trip",
    "data": obj! { "countries": countries },
    "blocks": [country_field, continue_button],
});
```

```rust
govuk::SELECT_INPUT.build(obj! {
    "code": "tripCountry",
    "label": obj! { "text": "Which country did you visit?" },
    "items": data("countries").each(iterator::map(obj! {
        "value": item().path("value"),
        "text": item().path("text"),
    })),
})
```

`data("countries")` resolves to the array attached to the step. The
block does not need to know where the list came from or how it was
built. It just declares what it needs and Forge provides it.

### Dynamic data

When data comes from an API or needs to be computed at runtime, an
effect function loads it and stores it with `context.set_data()`. The
block definition looks the same:

```rust
// In the step definition
let time_step = step(obj! {
    "path": "/choose-time",
    "title": "Choose a time",
    "onAccess": [
        access(obj! {
            "effects": [effect::call("LoadAppointmentSlots", vec![])],
        }),
    ],
    "blocks": [appointment_time_field, continue_button],
});
```

```rust
// In the effect implementation
FunctionEntry::effect("LoadAppointmentSlots", move |context, _args| {
    let appointment_api = appointment_api.clone();
    async move {
        let date = context.get_answer("appointmentDate");
        let kind = context.get_answer("appointmentType");
        let slots = appointment_api.get_slots(&kind, &date).await?;

        context.set_data("availableSlots", slots)
    }
})
```

```rust
// In the block definition
govuk::SELECT_INPUT.build(obj! {
    "code": "appointmentTime",
    "label": obj! { "text": "Choose a time" },
    "items": data("availableSlots").each(iterator::map(obj! {
        "value": item().path("time"),
        "text": item().path("time"),
    })),
})
```

The block references `data("availableSlots")` the same way it would
reference static data. It does not know or care that an effect loaded
this from an API. This is the key benefit: **block definitions stay
declarative regardless of where their data comes from.**

---

## How it works

When Forge evaluates a `data()` reference, it looks up the key in
the current data context. This context is built from two sources, in
order:

1. Static `data` properties from the journey and step definitions,
   merged together (step values take precedence when keys overlap).
2. Values set by effect functions through `context.set_data()` during
   the current request.

If an effect sets a key that also exists in the static data, the
effect's value wins for that request.

### Data inheritance

Data flows downward through the journey hierarchy. A journey's `data`
is available to all its steps and child journeys. Steps can add their
own data, which merges with the inherited values:

```rust
journey(obj! {
    "path": "/travel-declaration",
    "data": obj! {
        "maxTrips": 10,
        "supportEmail": "travel@example.com",
    },
    "steps": [
        step(obj! {
            "path": "/add-trip",
            "data": obj! { "countries": countries }, // merged with journey data
            "blocks": [/* ... */],
        }),
    ],
})
```

Inside the add-trip step, `data("countries")`, `data("maxTrips")`,
and `data("supportEmail")` all resolve. The step sees both its own
data and the data inherited from its parent journey.

---

## Using Data in conditions and hooks

`data()` works in conditions the same way `answer()` does. An access
hook might load data from an API, then check the result before
allowing the step to render:

```rust
"onAccess": [
    access(obj! {
        "effects": [effect::call("LoadCaseData", vec![params("caseId").into()])],
        "next": [
            throw_error(obj! {
                "when": data("case").not().matches(condition::is_required()),
                "status": 404,
                "message": "Case not found",
            }),
            redirect(obj! {
                "when": data("case.isReadOnly").matches(condition::equals(true)),
                "goto": "/overview",
            }),
        ],
    }),
],
```

Effects run before `next` outcomes are evaluated, so the data is
available for the conditions to test. This pattern of "load then
check" is covered in detail in
[Loading, saving and redirecting](../building-journeys/loading-saving-and-redirecting).

Data can also drive redirect paths dynamically:

```rust
redirect(obj! { "goto": data("redirectPath") })
```

---

## Nested values

Like `answer()`, `data()` supports dot notation for reaching into
nested objects:

```rust
data("case.isReadOnly")
data("session.caseDetails.givenName")
```

Forge splits the string on dots and walks the resulting path. The
`.path()` method works the same way and can be chained:

```rust
data("session").path("caseDetails").path("givenName")
```

---

## API surface

### `data(key)`

Creates a reference to a value in the current data context.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
```

`key` is a string, with optional dot notation for nested access.

Returns a chainable reference that supports `.path()`, `.matches()`,
`.pipe()`, and `.each()`.

### `.path(key)`

Navigates to a nested property within the referenced value. Supports
dot notation and can be chained.

```rust
data("session").path("caseDetails.givenName")
```

---

## Best practices

- **Use static `data` for values that do not change.** Country lists,
  configuration constants, enum options. These belong on the step or
  journey definition, not in an effect.
- **Use `context.set_data()` for values loaded at runtime.** API
  responses, computed values, anything that depends on the current
  request or user state.
- **Set shared data at the journey level.** If every step needs the
  same configuration or reference data, set it once on the journey
  rather than repeating it on each step.
- **Keep data keys short and descriptive.** `data("countries")` is
  clear. `data("staticReferenceDataCountryList")` is not.
- **Prefer `data()` over `answer()` for non-field values.** If a
  value was not entered by the user in a field, it belongs in the
  data context, not the answer context. This keeps the two contexts
  semantically distinct.
