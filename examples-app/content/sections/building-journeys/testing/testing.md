---
title: Testing
section: building-journeys
path: building-journeys/testing
teaches: [ForgeTestHarness, ForgeTestClient, TestRequestOptions, TestResult, blocks_by_variant, validation_errors_for]
prerequisites: [journey, step, block, field, onSubmission, onAccess, effects, register_package, ForgePackage]
---

<p class="govuk-caption-xl">Testing</p>

# Testing journeys

Forge ships a test adapter that lets you exercise your journeys in
unit tests without standing up a server, configuring templates, or
rendering HTML. You send requests, get back structured results, and
assert on the data.

{{slot:toc}}

---

## Setting up

Create a `ForgeTestHarness` from `forge_core::testing`, register your
components and packages, and call `create_client()`. Tests run on
Tokio (`#[tokio::test]`), because sending a request is async.

```rust
use forge_core::ForgeOptions;
use forge_core::testing::{ForgeTestHarness, TestRequestOptions};

let mut harness = ForgeTestHarness::new(ForgeOptions::default());
harness.register_global_components(forge_govuk_components::components())?;
harness.register_package(my_package(services))?;
let client = harness.create_client(None);
```

`ForgeTestHarness` wires up the test adapter internally. You register
components and packages the same way you would with `Forge`, then
`create_client(None)` gives you a `ForgeTestClient` you can send
requests through. Pass a renderer instead of `None` to have pages
rendered too.

---

## Sending requests

The client has two methods: `get()` and `post()`. Both take a path
and an optional options object where you provide session state,
request body, cookies, headers, and query parameters.

```rust
let result = client.get("/my-journey/step-one", TestRequestOptions::session(obj! { "user": "test" })).await?;

let result = client
    .post("/my-journey/step-one", TestRequestOptions::body(obj! { "firstName": "Sam" }))
    .await?;
```

Each request is independent. Session state, cookies, and headers are
passed explicitly per request  - the client does not carry state
between calls. To simulate a multi-step flow, take the session from
each result with `result.session()` and pass it to the next request.

---

## Reading results

Every request returns a `TestResult`, which is a render, a redirect,
or an error. Error results (`"type": "error"`) carry the `status` and
`message` from a `throw_error` outcome.

### Render results

When the engine renders a step, the result contains the full render
context: answers, data, blocks, validation errors, and step metadata.

```rust
let result = client.get("/my-journey/step-one", TestRequestOptions::default()).await?;

if let TestResult::Render { context, .. } = &result {
    // Answers loaded by effects
    assert_eq!(context.get("answers").get("firstName").get("current"), Value::from("Sam"));

    // Validation state
    assert_eq!(context.get("showValidationFailures"), Value::Bool(false));

    // Step metadata
    assert_eq!(context.get("step").get("title"), Value::from("What is your name?"));
}
```

### Redirect results

When the engine redirects (from a submission hook, access guard, or
reachability check), the result contains the target URL.

```rust
let result = client
    .post("/my-journey/step-one", TestRequestOptions::body(obj! { "firstName": "Sam" }))
    .await?;

if let Some(url) = result.redirect_url() {
    assert!(url.contains("step-two"));
}
```

Every result type also includes `headers` and `cookies` maps if you
need to assert on response metadata.

---

## Inspecting blocks

Render results include a `get_blocks_by_variant()` helper that returns
the evaluated blocks matching a given component variant. Each block
contains the fully resolved properties that would be passed to the
component at render time.

```rust
let result = client.get("/my-journey/step-one", TestRequestOptions::default()).await?;

let radios = result.blocks_by_variant("govuk-radios");
assert_eq!(radios.len(), 1);
assert_eq!(radios[0].get("properties").get("items").as_array().map(|i| i.len()), Some(3));
```

---

## Inspecting validation errors

Render results include a `get_validation_errors_by_field_code()` helper
that returns the validation errors for a specific field. Each error
contains the message and any details attached to the validation rule.

```rust
let result = client.post("/my-journey/step-one", TestRequestOptions::body(obj! {})).await?;

let errors = result.validation_errors_for("firstName");
assert_eq!(errors.len(), 1);
assert_eq!(errors[0].get("message"), Value::from("Enter your first name"));
```

You can also check all field validation errors at once via
`fieldValidationErrors` in `result.context()`, or use
`showValidationFailures` to check whether validation
is active.

---

## Substituting services in tests

When your journey uses effects that call external services, give the
package a stand-in service when you build it. Effects capture their
services when the package is built, so stubbing a service controls
what an effect does without replacing the effect itself.

```rust
use std::sync::{Arc, Mutex};

/// A stand-in for the real API that records what it was asked to save.
#[derive(Default)]
struct RecordingApi(Mutex<Vec<Value>>);

impl RecordApi for RecordingApi {
    fn save_record(&self, record: Value) {
        self.0.lock().unwrap().push(record);
    }
}

let api = Arc::new(RecordingApi::default());

let mut harness = ForgeTestHarness::new(ForgeOptions::default());
harness.register_global_components(forge_govuk_components::components())?;
harness.register_package(my_package(api.clone()))?;
let client = harness.create_client(None);

client
    .post("/my-journey/step-one", TestRequestOptions::body(obj! { "firstName": "Sam" }))
    .await?;

let saved = api.0.lock().unwrap();
assert_eq!(saved[0].get("firstName"), Value::from("Sam"));
```

This keeps the effect's real logic under test while the service it
calls is a spy you can assert on. It is useful when some effects only
touch the session (and can run against their real dependencies) while
others call APIs or databases that you want to stub out.

### Replacing an effect

To replace an effect outright, build the package with the journey's
functions and swap the one you want for a stub under the same name.
Two functions cannot share a name, so remove the real one first.

```rust
let recorded = Arc::new(Mutex::new(Vec::new()));
let seen = recorded.clone();

// The journey's own functions, with SaveRecord swapped for a recording stub
let mut functions: Vec<FunctionEntry> =
    my_functions(services).into_iter().filter(|f| &*f.name != "SaveRecord").collect();
functions.push(FunctionEntry::effect("SaveRecord", move |_context, args| {
    seen.lock().unwrap().push(args);
    async { Ok(()) }
}));

harness.register_package(ForgePackage::new(my_journey()).with_functions(functions))?;
```

---

## Testing patterns

### Branching

Post different answer values and assert on the redirect URL to verify
each branch lands on the correct step.

```rust
let result = client
    .post("/booking/visit-type", TestRequestOptions::body(obj! { "visitType": "in-person" }))
    .await?;

let url = result.redirect_url().expect("redirected");
assert!(url.contains("location"));
```

### Validation

Post without required fields and check that the result is a render
with validation errors.

```rust
let result = client.post("/booking/visit-type", TestRequestOptions::body(obj! {})).await?;

let context = result.context().expect("rendered");
assert_eq!(context.get("showValidationFailures"), Value::Bool(true));

let errors = result.validation_errors_for("visitType");
assert_eq!(errors.len(), 1);
```

### Session effects

Pass a mutable session object and check its state after the request
to verify that effects wrote the expected data.

```rust
let result = client
    .post("/booking/visit-type", TestRequestOptions::body(obj! { "visitType": "phone" }))
    .await?;

// The session as the request's effects left it
let drafts = result.session().get("patternDrafts");
assert_eq!(drafts.get("booking").get("visitType"), Value::from("phone"));
```

### Access guards

Pre-populate session state and verify that accessing a step either
renders or redirects based on the guard conditions.

```rust
// Without the required session state - redirected away
let blocked = client.get("/booking/confirmation", TestRequestOptions::default()).await?;
assert!(blocked.redirect_url().is_some());

// With the required session state - renders
let allowed = client
    .get("/booking/confirmation", TestRequestOptions::session(obj! { "patternSubmitted": obj! { "booking": true } }))
    .await?;
assert!(allowed.context().is_some());
```
