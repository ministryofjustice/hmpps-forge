---
title: Params
section: authoring-language
path: authoring-language/params
teaches: [params, route-parameters, parameterised-paths]
prerequisites: [step, StepDefinition, path, routing]
---

<p class="govuk-caption-xl">References</p>

# Params

`params()` references URL route parameters. When a step's path
includes a named segment like `:itemId`, `params("itemId")` resolves
to whatever value appears in that position at runtime.

{{slot:toc}}

---

## What is Params?

Steps and journeys can include route parameters in their paths. A
step at `/items/:itemId` matches any URL like `/items/abc123`, and
the value `abc123` is captured as the `itemId` parameter.
`params("itemId")` creates a reference to that captured value.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};

params("itemId")
```

Route parameters make journeys work for specific resources. A case
management journey at `/case/:caseId` can render the right case on
every page without hard-coding any identifiers. Each step and access
hook receives the same parameter values from the URL.

---

## How it works

Route parameters are defined by prefixing a path segment with `:`.
Forge uses the same syntax as Express and Topcoat:

```rust
journey(obj! {
    "code": "case-management",
    "path": "/case/:caseId",
    "steps": [overview_step, edit_step],
})
```

When a request arrives at `/case/A1234BC/overview`, Forge extracts
`caseId` as `"A1234BC"` and makes it available through
`params("caseId")` for the duration of that request.

In effect functions, the same values are available through
`context.get_request_param(key)` and `context.get_all_request_params()`:

```rust
FunctionEntry::effect("LoadCaseData", move |context, _args| {
    let case_api = case_api.clone();
    async move {
        let case_id = context.get_request_param("caseId");

        if case_id.is_nullish() {
            return Ok(());
        }

        let case_data = case_api.get_case(&case_id.to_js_string()).await?;
        context.set_data("case", case_data)
    }
})
```

Parameters can appear at any level. A journey parameter is available
to all its steps and child journeys. A step can add its own
parameters too:

```rust
step(obj! {
    "path": "/goal/:goalId/add-steps",
    "title": "Add steps to goal",
    // ...
})
```

Inside this step, both `params("caseId")` from the parent journey
and `params("goalId")` from the step itself are available.

---

## Using in your definitions

The most common use for `params()` is passing route parameters into
effect functions so they can load the right data:

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
        ],
    }),
],
```

Parameters also work in conditions. You can validate that a
parameter has an expected value before allowing access:

```rust
access(obj! {
    "when": params("areaOfNeed").not().matches(condition::array::is_in(data("validAreas"))),
    "next": [redirect(obj! { "goto": "/not-found" })],
})
```

And in `format()` for building dynamic URLs in redirects and links:

```rust
redirect(obj! {
    "goto": format("../%1/add-steps", [params("goalId").into()]),
})
```

```rust
govuk::BUTTON.build(obj! {
    "text": "View history",
    "href": format("%1?type=current", [params("timestamp").into()]),
})
```

Like any reference, parameters can be transformed with `.pipe()`:

```rust
govuk::HEADING.build(obj! {
    "text": format("Plan from %1", [params("timestamp").pipe([transformer::string::to_timestamp_date(), transformer::date::format("Do MMMM YYYY")]).into()]),
})
```

---

## API surface

### `params(key)`

Creates a reference to a URL route parameter.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
```

`key` is a string matching a `:paramName` segment in the step or
journey path.

Returns a chainable reference that supports `.path()`, `.matches()`,
`.pipe()`, and `.each()`.

---

## Best practices

- **Load data from parameters in access hooks.** The access
  lifecycle runs on every request, so data is always available when
  the page renders.
- **Validate parameters early.** Check that a parameter refers to a
  real resource before continuing. A `throw_error` with a 404 is
  clearer than letting a downstream effect fail.
- **Set journey-level parameters for shared resources.** If every
  step needs the same `:caseId`, put it on the journey path. Steps
  should only add parameters for step-specific resources.
