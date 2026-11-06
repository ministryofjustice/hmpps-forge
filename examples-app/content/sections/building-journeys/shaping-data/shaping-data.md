---
title: Shaping data for rendering
section: building-journeys
path: building-journeys/shaping-data
teaches: [derive-transformer, data-shaping, view-model, raw-data-to-render-model, inline-data-shaping]
prerequisites: [data, pipe, transformer, FunctionEntry, access-patterns]
---

<p class="govuk-caption-xl">Working with data</p>

# Shaping data for rendering

Effects load raw data from APIs and data stores. Blocks render
components. Between the two sits a question: what happens when the
raw data does not match the shape a component expects?

{{slot:toc}}

---

## The problem

An effect loads case data from an API and exposes it through
`data()`:

```rust
FunctionEntry::effect("LoadCaseData", move |context, args| {
    let case_api = case_api.clone();
    async move {
        let case_data = case_api.get_case(&args[0].to_js_string()).await?;
        context.set_data("case", case_data)?;
        Ok(())
    }
})
```

The API returns a nested structure:

```json
{
  "person": { "firstName": "Sam", "lastName": "Jones", "dateOfBirth": "1990-03-15" },
  "status": "ACTIVE",
  "riskLevel": "HIGH",
  "assignedOfficer": { "name": "Alex Smith", "team": "Probation - North" },
  "nextAppointment": "2026-05-01T10:30:00Z"
}
```

A summary list block needs rows with `key` and `value` objects. A
tag component needs a `text` and `classes` pair. A heading needs a
formatted full name. None of these match the API shape directly.

You could reach into the structure from blocks using `data()` paths,
conditionals, and formatting:

```rust
govuk::SUMMARY_LIST.build(obj! {
    "rows": [
        obj! {
            "key": obj! { "text": "Name" },
            "value": obj! {
                "text": format("%1 %2", [data("case.person.firstName").into(), data("case.person.lastName").into()]),
            },
        },
        obj! {
            "key": obj! { "text": "Status" },
            "value": obj! {
                "html": when(data("case.status").matches(condition::equals("ACTIVE"))).then("<strong class=\"govuk-tag govuk-tag--green\">Active</strong>").otherwise(when(data("case.status").matches(condition::equals("INACTIVE"))).then("<strong class=\"govuk-tag govuk-tag--grey\">Inactive</strong>").otherwise("<strong class=\"govuk-tag govuk-tag--red\">Archived</strong>")),
            },
        },
        obj! {
            "key": obj! { "text": "Risk level" },
            "value": obj! { "text": data("case.riskLevel") },
        },
        obj! {
            "key": obj! { "text": "Officer" },
            "value": obj! {
                "text": format("%1 (%2)", [data("case.assignedOfficer.name").into(), data("case.assignedOfficer.team").into()]),
            },
        },
        obj! {
            "key": obj! { "text": "Next appointment" },
            "value": obj! {
                "text": data("case.nextAppointment").pipe([transformer::string::to_date(), transformer::date::format("Do MMMM YYYY, HH:mm")]),
            },
        },
    ],
})
```

This works, but the block definition is now doing two jobs: it
declares the page structure and it reshapes the data. As the API
response grows, the block grows with it. The page structure gets
buried under data-shaping logic.

---

## Separating the concerns

The cleaner approach is to move the data shaping out of the block
and into a transformer. The block receives render-ready values.
The transformer handles the conversion:

```text
Effect            loads raw API data
data()            exposes it to the step
Transformer       derives the render model
Block             declares the page structure
```

The block becomes a clean declaration of what the page looks like:

```rust
let case_summary = govuk::SUMMARY_LIST.build(obj! {
    "rows": data("case").pipe([transformer::call("ToCaseSummaryRows", vec![])]),
});
```

The transformer contains the data-shaping logic:

```rust
FunctionEntry::transformer("ToCaseSummaryRows", |data, _args| {
    let (person, officer) = (data.get("person"), data.get("assignedOfficer"));

    Ok(Value::from(vec![
        obj! {
            "key": obj! { "text": "Name" },
            "value": obj! { "text": format!("{} {}", person.get("firstName").to_js_string(), person.get("lastName").to_js_string()) },
        },
        obj! {
            "key": obj! { "text": "Status" },
            "value": obj! { "html": status_tag(&data.get("status")) },
        },
        obj! {
            "key": obj! { "text": "Risk level" },
            "value": obj! { "text": data.get("riskLevel") },
        },
        obj! {
            "key": obj! { "text": "Officer" },
            "value": obj! { "text": format!("{} ({})", officer.get("name").to_js_string(), officer.get("team").to_js_string()) },
        },
        obj! {
            "key": obj! { "text": "Next appointment" },
            "value": obj! { "text": format_date(&data.get("nextAppointment")) },
        },
    ]))
})
```

This is not domain logic pretending to be reusable application
logic. It is deliberately view-specific. It knows about summary
list rows, tag colours, date formatting, and whatever shape the
component expects. That is its job.

---

## When to reach for a transformer

Not every `data()` reference needs a transformer. Simple cases
work well inline:

```rust
govuk::HEADING.build(obj! { "text": data("case.person.firstName"), "size": "l" })
govuk::BODY.build(obj! { "text": data("case.description") })
```

A transformer becomes useful when:

- The raw data does not match the component props and needs
  restructuring (for example, API objects into summary list rows).
- The block contains deep nesting of `when().then().otherwise()`,
  `format()`, or `data().path()` calls.
- Several component props are really part of the same render
  decision (for example, a tag's text, colour, and visibility all
  depend on the same status field).
- The step definition is starting to obscure the page structure
  under data-shaping logic.

---

## Writing derive transformers

A derive transformer converts raw data into a render-ready shape.
There are two ways to define one, depending on whether it is
shared or local.

### Shared transformers with a named entry

When a transformer is used across multiple steps or is complex
enough to warrant its own tests, give it a name with
`FunctionEntry::transformer` and let definitions call it by that name.
See [Custom transformers](../building-functions-and-components/custom-transformers)
for the full pattern.

```rust
use forge_core::FunctionEntry;

pub fn case_transformers() -> Vec<FunctionEntry> {
    vec![FunctionEntry::transformer("ToCaseSummaryRows", |data, _args| {
        let person = data.get("person");

        Ok(Value::from(vec![
            obj! { "key": obj! { "text": "Name" }, "value": obj! { "text": format!("{} {}", person.get("firstName").to_js_string(), person.get("lastName").to_js_string()) } },
            obj! { "key": obj! { "text": "Status" }, "value": obj! { "html": status_tag(&data.get("status")) } },
        ]))
    })]
}
```

Definitions call `transformer::call("ToCaseSummaryRows", vec![])` to
build the piped expression. The entries themselves are what you pass
to `ForgePackage::new(journey).with_functions(case_transformers())`.

### Inline transformers with anonymous registration

When a transformer only serves one block, register it anonymously
on a `Functions` collector right where it is used. Anonymous
registrations are named automatically. See
[Inlining functions](../building-functions-and-components/inline-functions)
for the full API.

```rust
use forge_core::authoring::*;
use forge_govuk_components::blocks as govuk;

pub fn case_summary(functions: &Functions) -> Value {
    govuk::SUMMARY_LIST.build(obj! {
        "rows": data("case").pipe([functions
            .transformer(|data, _args| {
                let person = data.get("person");

                Ok(Value::from(vec![
                    obj! { "key": obj! { "text": "Name" }, "value": obj! { "text": format!("{} {}", person.get("firstName").to_js_string(), person.get("lastName").to_js_string()) } },
                    obj! { "key": obj! { "text": "Status" }, "value": obj! { "html": status_tag(&data.get("status")) } },
                ]))
            })
            .call(vec![])]),
    })
}
```

The registration returns a handle, so it is called immediately —
the trailing `.call(vec![])` produces the piped expression. Both
approaches go through the same registration and evaluation pipeline. The choice is
about where the code lives, not how it runs.

---

## Keeping responsibilities clear

Each layer in the pipeline has a single job:

```text
Effects           fetch, save, call APIs, write request data
Data              store raw request-time data
Transformers      convert raw data into render-ready values
Blocks            declare and render the page structure
```

Effects should not format data for display. Transformers should
not call APIs or mutate context. Blocks should not contain
branching logic to reshape data structures.

Repeated evaluation is acceptable. Transformers run at render time
on every request, but they are not doing IO. They take a value and
return a new value. The cost is negligible compared to the API
call that loaded the data in the first place.

---

## Best practices

- **Start inline, extract when needed.** Begin with `data()` paths
  and simple `.pipe()` calls in blocks. When the block definition
  starts to obscure the page structure, move the shaping logic into
  a transformer.
- **Keep transformers view-specific.** A transformer that returns
  summary list rows knows about `key` and `value` objects. That is
  fine. It is a view concern, not domain logic.
- **Do not reshape data in effects.** Effects load and save. If an
  API response needs restructuring for a component, that is a
  transformer's job. Mixing the two makes effects harder to test
  and ties them to specific component shapes.
- **Name transformers after the output shape.** `ToCaseSummaryRows`
  describes what comes out. `ProcessCaseData` does not.
- **Validate the input type.** Transformer inputs are untyped
  `Value`s. Check the shape before operating on the value and
  return a `ForgeError::Type` for mismatches.
