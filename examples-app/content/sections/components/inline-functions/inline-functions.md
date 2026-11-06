---
title: Inlining functions
section: building-functions-and-components
path: building-functions-and-components/inline-functions
teaches: [Functions, anonymous-registration, inline-transformer, inline-condition, inline-effect, inline-generator]
prerequisites: [FunctionEntry, ForgePackage, pipe, match-method]
---

<p class="govuk-caption-xl">Functions</p>

# Inlining functions

Registering a function without a name lets you define one-off
functions directly where they are used, inline at the call site.

{{slot:toc}}

---

## The concept

A named registration gives a function a stable key and a documented
helper. That is valuable when a function is shared across steps or
forms a named part of a package's API.

But some functions are local to a single block or step. A
transformer that shapes data for one summary list, a condition that
controls one `visibleWhen`, or an effect that loads data for one
page. For these, a separate name and helper add friction without adding
clarity.

A `Functions` collector (from `forge_core::authoring`) registers
functions without a name. Call `transformer`, `condition`, `effect`
or `generator` on it with just a closure, and it stores the function
under an auto-generated name and returns a `FunctionHandle` for
immediate use. Calling the handle — note the trailing
`.call(vec![])` — produces the expression the definition needs:

```text
Named registration:
  FunctionEntry::transformer("Name", f)    →  helper function  →  used in blocks.rs

Anonymous registration:
  functions.transformer(f).call(vec![])    →  expression used inline, right here
```

The collector does two things at once: it stores the function for
registration, and it returns the handle that builds the expression
the definition needs.

---

## How it works

The package function creates the collector and passes it to the
functions that build the journey. Each inline registration stores
its closure in the collector while the definition is being built,
before any request is served.

The package function then passes the collector to
`with_functions()`. From that point on, the collected functions are
registered exactly like named ones. Inline functions that need
services capture them in their closures, so the definition builders
take the services too.

```text
1. Definition built       functions.transformer(f)
                          → stores the closure, returns a handle

2. Package assembled      ForgePackage::new(journey).with_functions(&functions)
                          → the collected entries join the package

3. Package registered     forge.register_package(package)
                          → the entries are registered by name

4. Request time           engine evaluates expression
                          → calls f(value, args)
```

Build the journey before calling `with_functions()`, so every
function registered while building it is in the collector by the
time the package reads it.

Anonymous registrations are named automatically in call order —
`__anon_0`, `__anon_1`, and so on. These names are internal; you
never reference them. If you want a stable name for debugging,
register a named `FunctionEntry` with `functions.register(entry)`.

---

## One collector per package

A `Functions` collector holds functions of every kind, so a package
needs only one, created where the package is assembled:

```rust
use forge_core::authoring::Functions;

// One collector per package, created where the package is assembled
let functions = Functions::new();
```

Pass `&functions` to each block or step function that registers
inline functions. Cloning a `Functions` shares the same collection.

### Inline transformer

`transformer` returns a handle; calling it produces a transformer
expression for use with `.pipe()`:

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

pub fn case_summary(functions: &Functions) -> Value {
    govuk::SUMMARY_LIST.build(obj! {
        "rows": [obj! {
            "key": obj! { "text": "Status" },
            "value": obj! {
                "text": data("caseDetails").pipe([functions
                    .transformer(|details, _args| {
                        Ok(Value::from(if details.get("status").as_str() == Some("closed") {
                            "Closed".to_string()
                        } else {
                            format!("Open - {}", details.get("priority").to_js_string())
                        }))
                    })
                    .call(vec![])]),
            },
        }],
    })
}
```

The closure follows the same `|value, args| -> ForgeResult<Value>`
shape as a named transformer. It receives the resolved value and
any arguments.

### Inline condition

`condition` returns a handle; calling it produces a condition
expression for use with `.matches()`:

```rust
pub fn urgent_banner(functions: &Functions) -> Value {
    govuk::BODY.build(obj! {
        "text": "This case requires immediate attention.",
        "visibleWhen": data("caseDetails").matches(
            functions
                .condition(|details, _args| {
                    Ok(details.get("priority").as_str() == Some("urgent")
                        && details.get("status").as_str() != Some("closed"))
                })
                .call(vec![]),
        ),
    })
}
```

### Inline effect

`effect` returns a handle; calling it produces an effect expression
for use in `onAccess` and `onSubmission` hooks:

```rust
pub fn my_step(functions: &Functions, services: &Arc<Services>) -> Value {
    let api = services.api.clone();
    step(obj! {
        "path": "/overview",
        "title": "Overview",
        "reachability": obj! { "entryWhen": true },
        "onAccess": [access(obj! {
            "effects": [functions
                .effect(move |context, _args| {
                    let api = api.clone();
                    async move {
                        let data = api.get_overview().await?;
                        context.set_data("overview", data)
                    }
                })
                .call(vec![])],
        })],
        "blocks": [content()],
    })
}
```

### Inline generator

`generator` returns a handle; calling it produces a generator
expression for use anywhere a dynamic value is accepted:

```rust
pub fn timestamp(functions: &Functions) -> Value {
    govuk::BODY.build(obj! {
        "text": functions
            .generator(|_args| Ok(Value::from(forge_core::jsdate::JsDate::now().local_fields().map(|f| f.year).unwrap_or_default().to_string())))
            .call(vec![]),
    })
}
```

---

## Registration

Pass the collector to `with_functions()`, after building the
journey:

```rust
use forge_core::ForgePackage;
use forge_core::authoring::Functions;

pub fn my_package(services: Arc<Services>) -> ForgePackage {
    let functions = Functions::new();
    let journey = my_journey(&functions, &services);

    ForgePackage::new(journey)
        .with_functions(&functions)
        .with_functions(my_conditions())
}
```

`with_functions()` can be called again for named entries. Every
entry is registered the same way when you call
`forge.register_package(package)`.

---

## Reusing an inline function

A registration returns a handle you can capture and call more than once.
When the same logic is needed in several places, register it once at
module level and call the handle wherever you need it, rather than
registering the function inline each time:

```rust
use forge_core::authoring::*;

pub fn status_tags(functions: &Functions) -> Vec<Value> {
    let to_status_tag = functions.transformer(|value, _args| {
        Ok(match value.as_str() {
            Some("completed") => obj! { "text": "Completed", "classes": "govuk-tag--green" },
            Some("in-progress") => obj! { "text": "In progress", "classes": "govuk-tag--blue" },
            _ => obj! { "text": "Not yet started" },
        })
    });

    let status_tag = |code: &str| answer(code).pipe([to_status_tag.call(vec![])]);

    vec![status_tag("task1Status").into(), status_tag("task2Status").into()]
}
```

Both calls reuse the same registration. Only the piped reference
differs. Registering once also keeps the collector free of duplicate
entries: registering inside a helper that runs more than once would
store the same closure under several anonymous names.

---

## Best practices

- **One collector per package.** Create it where the package is
  assembled and pass it to the step and block functions. This keeps
  all inline functions flowing through a single collector.
- **Register shared logic once.** Capture the handle and reuse it,
  rather than registering the same function inline in several
  places.
- **Use named registrations for shared functions.** If more than one
  step uses the same function, or if the function is complex enough
  to warrant its own tests, register it with a name and give it a
  helper function, as the custom-function pages describe.
- **Use anonymous registration for local functions.** If a function
  exists only to serve one block or step, registering it inline
  keeps the definition and the logic together.
- **Keep inline functions short.** If an inline function grows
  beyond 10 to 15 lines, it is probably complex enough to benefit
  from its own module, its own tests, and a named registration.
