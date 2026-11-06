---
title: Custom effects
section: building-functions-and-components
path: building-functions-and-components/custom-effects
teaches: [FunctionEntry, effect-helpers, EffectContext, effect-implementation, typed-answers, TestEffectContext]
prerequisites: [onAccess, onSubmission, access, submit, data, answer, ForgePackage]
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

Custom effects are declared as `FunctionEntry::effect` entries. You
collect the entries in a function that takes the services they need,
and can give each effect a small helper function for use in journey
definitions. Each closure follows the pattern
`|context, args| async { ... }`, returning a future of
`ForgeResult<()>`:

```rust
use std::sync::Arc;

use forge_core::authoring::effect;
use forge_core::{FunctionEntry, Value, obj};

pub fn my_effects(services: Arc<Services>) -> Vec<FunctionEntry> {
    let (case_api, form_data_store) = (services.case_api.clone(), services.form_data_store.clone());
    vec![
        // Loads case data from the API and sets it on the data context.
        // args[0] - the unique identifier of the case to load.
        FunctionEntry::effect("LoadCaseData", move |context, args| {
            let case_api = case_api.clone();
            async move {
                let case_data = case_api.get_case(&args[0].to_js_string()).await?;

                context.set_data("case", case_data)
            }
        }),
        // Persists all current answers to the data store.
        FunctionEntry::effect("SaveAnswers", move |context, _args| {
            let form_data_store = form_data_store.clone();
            async move {
                let session_id = context.get_session().get("id").to_js_string();
                let answers = context.get_all_answers();

                form_data_store.save(&session_id, answers).await
            }
        }),
        // Collects trip field answers into a structured object and appends it to the trips array.
        FunctionEntry::effect("AddTrip", |context, _args| async move {
            let trip = obj! {
                "country": context.get_answer("tripCountry"),
                "departureDate": context.get_answer("tripDepartureDate"),
                "returnDate": context.get_answer("tripReturnDate"),
                "reason": context.get_answer("tripReason"),
            };

            let mut trips = context.get_answer("trips").as_array().map(|t| t.to_vec()).unwrap_or_default();
            trips.push(trip);
            context.set_answer("trips", Value::from(trips))?;

            context.set_answer("tripCountry", Value::Undefined)?;
            context.set_answer("tripDepartureDate", Value::Undefined)?;
            context.set_answer("tripReturnDate", Value::Undefined)?;
            context.set_answer("tripReason", Value::Undefined)?;
            Ok(())
        }),
        // Removes a trip from the trips array by its position.
        // args[0] - the zero-based index of the trip to remove.
        FunctionEntry::effect("RemoveTrip", |context, args| async move {
            let index = args[0].as_f64().unwrap_or(-1.0) as i64;
            let trips = context.get_answer("trips");
            let kept: Vec<Value> = trips.as_array().map(|t| t.iter().enumerate().filter(|(i, _)| *i as i64 != index).map(|(_, t)| t.clone()).collect()).unwrap_or_default();
            context.set_answer("trips", Value::from(kept))
        }),
    ]
}

/// Loads case data from the API and sets it on the data context.
pub fn load_case_data(case_id: impl Into<Value>) -> Value {
    effect::call("LoadCaseData", vec![case_id.into()])
}
```

`effect::call("LoadCaseData", vec![params("caseId").into()])` creates an effect
expression that Forge runs inside a hook. The helper functions are
optional: `load_case_data(params("caseId"))` is just that call with
the name filled in. Arguments passed to an effect are expressions
that Forge resolves before calling the effect:

```rust
access(obj! {
    "effects": [effect::call("LoadCaseData", vec![params("caseId").into()])],
})
```

When the hook runs, Forge resolves `params("caseId")` to the
actual value from the URL and passes it to the effect function.

Arguments are `Value`s, so a helper that takes `impl Into<Value>`
accepts both strings and expressions. Forge resolves the expression
before the effect runs.

---

## Author-time preparation

The helper function runs when the definition is built. Use it to
sanitise or reshape arguments before they enter the expression tree,
and to reject invalid arguments early — when the journey is built
rather than at render time.

The helper receives only the arguments the author passed, and
decides what goes into the built expression.

```rust
/// Removes a trip from the trips array by its position.
pub fn remove_trip(index: i64) -> Value {
    assert!(index >= 0, "RemoveTrip requires a non-negative integer index");

    effect::call("RemoveTrip", vec![Value::from(index)])
}
```

A bad call fails as soon as the definition is built:

```rust
// Panics with 'RemoveTrip requires a non-negative integer index'.
remove_trip(-1)
```

The helper does not see services or the runtime context, so it can
only check structural properties of the arguments: required fields,
numeric ranges, enum membership, or combinations of arguments.
Checks that depend on the context belong inside the effect. A
`FunctionEntry` also accepts `with_arguments(Schema::Tuple(...))`
when you only need to validate the arguments without reshaping them
— note it runs at request time, each time the effect is evaluated,
whereas the helper runs once, when the definition is built.

Argument-count mismatches against a tuple schema are additionally caught at `register_package()` by semantic analysis, so a call with the wrong number of arguments fails compilation instead of waiting for request time.

If an argument is itself an expression like `params("caseId")`, its
resolved value is not available at author time. Validate the
resolved value inside the evaluator instead.

---

## The effect context

Unlike transformers, generators, and conditions, effects receive an
`EffectContext` as their first parameter. This context gives them
read and write access to the current request's state.

### Answers

Read and write field values:

```rust
context.get_answer("email")                       // get a single answer
context.set_answer("email", value)?               // set a single answer
context.get_all_answers()                         // get all answers as a map
context.get_answer_history("email")               // get mutation history for one answer
context.get_all_answer_histories()                // get mutation history for all answers
context.has_answer("email")                       // check if an answer exists
context.clear_answer("email")                     // remove an answer
```

`set_answer` is how effects modify user state. Setting an answer
changes what the field displays on the next render and what gets
submitted on the next POST.

### Data

Set values for `data()` references:

```rust
context.get_data("availableSlots")
context.set_data("availableSlots", slots)?
context.set_data("case", case_data)?
context.get_all_data()
```

Values set through `set_data` are available through `data()` for
the rest of the current request. They are not persisted between
requests. If a value needs to survive across page loads, store it
in answers or in an external data store.

### Request

Read information from the current request:

```rust
context.get_request_url()            // full request URL
context.get_request_param("caseId")  // single route parameter
context.get_all_request_params()     // all route parameters
context.get_query_param("page")      // single query string parameter
context.get_all_query_params()       // all query string parameters
context.get_post_data("action")      // single raw POST body value
context.get_all_post_data()          // all raw POST body values
context.get_session()                // session data
context.update_session(|session| { /* ... */ }) // change the session
context.get_state("user")            // custom request state
context.get_all_state()              // all custom request state
```

These are read-only views of the request, apart from the session,
which `update_session` changes. To act on them, use the answers and
data methods above.

Request state is supplied by the framework adapter. In the Topcoat
adapter, it is the `state` you set in `AdapterOptions`, plus
`csrfToken` and `cspNonce`. It is the same for every request.

Every getter returns an untyped `Value`. Nothing validates external
request data, so check values from POST data before using them.

### Headers and cookies

Read request headers and cookies:

```rust
context.get_request_header("accept")
context.get_all_request_headers()
context.get_request_cookie("session")
context.get_all_request_cookies()
```

Set response headers and cookies through the framework adapter:

```rust
use forge_core::framework::CookieOptions;

context.set_response_header("cache-control", "no-store");
context.set_response_cookie("preference", "compact", Some(CookieOptions { http_only: Some(true), ..CookieOptions::default() }));
```

These are write-only. There are no matching getters for response
headers or cookies, the values go straight to the framework adapter.

### Reachability

```rust
context.get_fields_to_clear()
```

Returns answer keys from fields that are no longer reachable due
to conditional logic (for example, a phone number field that was
hidden because the user changed their contact method to email).
This is useful for effects that persist answers and need to clear
stale values.

---

## Typed contexts

The context itself is untyped, but you can get full type safety on
answers and session data by deserialising them with serde. Define
structs for your answer and session shapes:

```rust
use serde::Deserialize;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MyAnswers {
    full_name: Option<String>,
    email: Option<String>,
    contact_method: Option<ContactMethod>,
    #[serde(default)]
    trips: Vec<Trip>,
}

#[derive(Deserialize)]
#[serde(rename_all = "lowercase")]
enum ContactMethod {
    Email,
    Phone,
    Text,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MySession {
    id: String,
    user_id: String,
}
```

Then deserialise inside your effects:

```rust
FunctionEntry::effect("SaveAnswers", |context, _args| async move {
    let answers: MyAnswers = serde_json::from_value(Value::object(context.get_all_answers()).to_json())
        .map_err(|e| ForgeError::type_error(e.to_string()))?;
    let session: MySession = serde_json::from_value(context.get_session().to_json())
        .map_err(|e| ForgeError::type_error(e.to_string()))?;

    let name = answers.full_name;          // Option<String>
    let method = answers.contact_method;   // Option<ContactMethod>
    // ...
    Ok(())
})
```

Make answer fields `Option`s (or `#[serde(default)]`) so
unanswered questions deserialise, and leave out
`deny_unknown_fields` so answers that are not declared in the struct
are ignored.

If you are not using typed structs, read individual values at the
call site with the `Value` accessors:

```rust
let name = context.get_answer("fullName").as_str().map(str::to_owned);
let available_slots = context.get_data("availableSlots");
let action = context.get_post_data("action").as_str().map(str::to_owned);
let post_data = context.get_all_post_data();
```

---

## Async patterns

Effects are always async: the closure returns a future. Most real
effects await external services:

```rust
FunctionEntry::effect("LoadCaseData", move |context, args| {
    let case_api = case_api.clone();
    async move {
        let case_data = case_api.get_case(&args[0].to_js_string()).await?;
        context.set_data("case", case_data)
    }
})
```

When multiple effects appear in the same hook, they run in
sequence. Each one completes before the next starts:

```rust
"onAccess": [
    access(obj! {
        "effects": [
            effect::call("LoadCaseData", vec![params("caseId").into()]),
            effect::call("LoadAppointmentSlots", vec![]),
        ],
    }),
],
```

Here `LoadCaseData` finishes before `LoadAppointmentSlots` begins.
If the second effect depends on data loaded by the first, this
ordering is guaranteed.

---

## Registration

Pass the entries to a package with `with_functions()`:

```rust
use forge_core::ForgePackage;

pub fn my_package(services: Arc<Services>) -> ForgePackage {
    ForgePackage::new(my_journey()).with_functions(my_effects(services))
}
```

Call `with_functions()` once per group when a package mixes effects
with conditions, transformers, or generators:

```rust
ForgePackage::new(my_journey())
    .with_functions(my_effects(services.clone()))
    .with_functions(my_conditions())
```

Services are passed in at application startup:

```rust
// The services each effect needs are captured when the entries are built
let package = my_package(Arc::new(Services {
    case_api: services.case_api.clone(),
    form_data_store: services.form_data_store.clone(),
}));
forge.register_package(package)?;
```

Every effect captures the services it needs when the entries are
built. This keeps effects decoupled from service construction and
makes them straightforward to test. To make effects available to
every journey rather than a single package, register the entries
globally instead:

```rust
forge.register_global_functions(my_effects(services.clone()))?;
```

---

## Common patterns

### Loading and saving answers

The most common pair of effects. Load answers from a data store on
access, save them on submission:

```rust
FunctionEntry::effect("LoadAnswers", move |context, _args| {
    let store = store.clone();
    async move {
        let session_id = context.get_session().get("id").to_js_string();

        if let Some(saved) = store.get(&session_id).await? {
            for (code, value) in saved {
                if !context.has_answer(&code) {
                    context.set_answer(&code, value)?;
                }
            }
        }
        Ok(())
    }
}),

FunctionEntry::effect("SaveAnswers", move |context, _args| {
    let store = store.clone();
    async move {
        let session_id = context.get_session().get("id").to_js_string();
        let answers = context.get_all_answers();

        store.save(&session_id, answers).await
    }
}),
```

The `has_answer` check in `LoadAnswers` avoids overwriting values
the user has just submitted. Without it, a POST request would load
old saved values on top of the new submission.

### Loading data for display

Load from an API and expose through `data()`:

```rust
FunctionEntry::effect("LoadAppointmentSlots", move |context, _args| {
    let appointment_api = appointment_api.clone();
    async move {
        let date = context.get_answer("appointmentDate");
        let kind = context.get_answer("appointmentType");
        let slots = appointment_api.get_slots(&kind, &date).await?;

        context.set_data("availableSlots", slots)
    }
}),
```

Blocks reference `data("availableSlots")` without knowing where
the data came from.

### Collecting fields into a structure

Gather individual field answers into a structured object and
append it to an array:

```rust
FunctionEntry::effect("AddTrip", |context, _args| async move {
    let trip = obj! {
        "country": context.get_answer("tripCountry"),
        "departureDate": context.get_answer("tripDepartureDate"),
        "returnDate": context.get_answer("tripReturnDate"),
    };

    let mut trips = context.get_answer("trips").as_array().map(|t| t.to_vec()).unwrap_or_default();
    trips.push(trip);
    context.set_answer("trips", Value::from(trips))?;

    // Clear the temporary fields
    context.set_answer("tripCountry", Value::Undefined)?;
    context.set_answer("tripDepartureDate", Value::Undefined)?;
    context.set_answer("tripReturnDate", Value::Undefined)?;
    Ok(())
}),
```

---

## Testing

Build the entries with stub services, find the effect by name, and
run it with `run_effect()` against a `TestEffectContext` from
`forge_core::testing`. The test context starts with the answers,
data, session and request values you give it, and lets you read back
what the effect wrote:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use forge_core::testing::TestEffectContext;

    mod load_case_data {
        use super::*;

        #[tokio::test]
        async fn should_load_case_data_and_set_it_on_the_context() {
            // Arrange
            let case_data = obj! { "id": "123", "name": "Test case" };
            let case_api = Arc::new(StubCaseApi::returning(case_data.clone()));
            let services = Arc::new(Services { case_api: case_api.clone(), form_data_store: Arc::new(StubStore::default()) });

            let context = TestEffectContext::new();
            let load_case_data = effect(&my_effects(services), "LoadCaseData");

            // Act
            load_case_data.run_effect(context.context(), vec!["123".into()]).await.unwrap();

            // Assert
            assert_eq!(case_api.requested(), vec!["123".to_string()]);
            assert_eq!(context.data().get("case"), Some(&case_data));
        }
    }

    mod add_trip {
        use super::*;

        #[tokio::test]
        async fn should_append_a_trip_and_clear_temporary_fields() {
            // Arrange
            let context = TestEffectContext::new().with_answers(obj! {
                "tripCountry": "France",
                "tripDepartureDate": "2026-06-01",
                "tripReturnDate": "2026-06-14",
                "trips": [obj! { "country": "Spain", "departureDate": "2026-01-01", "returnDate": "2026-01-07" }],
            });

            let add_trip = effect(&my_effects(stub_services()), "AddTrip");

            // Act
            add_trip.run_effect(context.context(), vec![]).await.unwrap();

            // Assert
            let answers = context.answers();
            assert_eq!(answers.get("trips").and_then(|t| t.as_array()).map(|t| t.len()), Some(2));
            assert!(answers.get("tripCountry").is_none_or(|v| v.is_undefined()));
        }
    }

    fn effect(entries: &[FunctionEntry], name: &str) -> FunctionEntry {
        entries.iter().find(|f| &*f.name == name).unwrap().clone()
    }
}
```

`run_effect()` runs the arguments schema too, exactly as Forge does
when a hook runs the effect. For effects with many context
interactions, a helper function that builds a `TestEffectContext`
from an initial state can reduce boilerplate across tests.

---

## Best practices

- **Keep effects focused.** Each effect should do one thing: load
  data, save answers, call an API. Compose multiple effects in a
  hook's `effects` array rather than building one large effect that
  does everything.
- **Use `context.has_answer()` before overwriting.** When loading
  saved answers, check if the user has already entered a value to
  avoid overwriting their input.
- **Use `context.set_data()` for values blocks need.** Data set by
  effects is available through `data()` references for the rest of
  the request.
- **Pass services in, do not construct them in effects.** Building
  the entries from a `services` argument keeps effects testable and
  decoupled from how services are constructed.
- **Handle errors at the right level.** If an API call fails, let
  the error propagate so Forge's error handling can catch it. Only
  catch errors when you need to transform them into a different
  outcome (for example, setting a "not found" flag on the data
  context).
- **Validate arguments early.** Use a helper function to catch
  configuration errors when the definition is built, or an
  arguments schema to catch them at request time before the effect
  runs.
