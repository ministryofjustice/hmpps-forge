---
title: Shaping data inline
section: patterns
path: patterns/inline-functions
teaches: [inline-function-pattern, scoped-transformer, scoped-condition, data-shaping-pattern, derive-transformer]
prerequisites: [Functions, data, pipe, match-method]
---

<p class="govuk-caption-xl">Patterns</p>

# Shaping data inline

When an effect loads structured data from an API or data store,
the block definition often needs to reshape it before rendering.
Rather than scattering `when().then().otherwise()` chains and deep
`data()` paths across the block, you can register small
transformers and conditions on a `Functions` collector right where
they are used.

This pattern keeps the effect focused on loading, keeps the block
focused on page structure, and puts the data-shaping logic in a
named, testable unit that lives at the call site.

<p class="govuk-body"><a class="govuk-button" href="/forge-developer-guide/patterns/demos/inline-functions" data-module="govuk-button">Try the live demo</a></p>

{{slot:toc}}

---

## The problem

Consider a case overview page. The effect loads a nested object
with risk scores, goals, and compliance data. The block needs to
render each risk score as a coloured tag, compute goal progress,
and calculate a compliance percentage.

Using expressions alone, every risk score needs a
`when().then().otherwise()` chain for both its text and its colour.
Six risk areas means twelve chains of identical logic. Goal counts
and percentages cannot be computed in expressions at all, so the
effect has to pre-compute them. The block definition grows long
and repetitive, and the page structure gets buried under
data-shaping logic.

---

## The solution

With a `Functions` collector, the repeated logic collapses into a
single inline transformer. Register it once to get a handle, then a
reusable helper function reuses that handle for each risk area:

```rust
use forge_core::authoring::*;
use forge_core::{FunctionEntry, Value, obj};
use forge_govuk_components::blocks as govuk;

let functions = Functions::new();

fn risk_level_tag(functions: &Functions) -> FunctionHandle {
    functions.register(FunctionEntry::transformer("RiskLevelTag", |value, _args| {
        let (text, colour) = match value.as_str() {
            Some("VERY_HIGH") => ("Very high".to_string(), "red"),
            Some("HIGH") => ("High".to_string(), "red"),
            Some("MEDIUM") => ("Medium".to_string(), "yellow"),
            Some("LOW") => ("Low".to_string(), "green"),
            _ => (value.to_js_string(), "grey"),
        };

        Ok(Value::from(format!(r#"<strong class="govuk-tag govuk-tag--{colour}">{text}</strong>"#)))
    }))
}

fn risk_row(area: &str, reference: Ex, risk_level_tag: &FunctionHandle) -> Value {
    obj! {
        "key": obj! { "text": area },
        "value": obj! {
            "html": reference.pipe([risk_level_tag.call(vec![])]),
        },
    }
}

pub fn risk_scores(functions: &Functions) -> Value {
    let tag = risk_level_tag(functions);
    govuk::SUMMARY_LIST.build(obj! {
        "rows": [
            risk_row("Overall", data("case.riskScores.overall"), &tag),
            risk_row("Self-harm", data("case.riskScores.selfHarm"), &tag),
            risk_row("Public protection", data("case.riskScores.publicProtection"), &tag),
            risk_row("Known adult", data("case.riskScores.knownAdult"), &tag),
            risk_row("Children", data("case.riskScores.children"), &tag),
            risk_row("Staff", data("case.riskScores.staff"), &tag),
        ],
    })
}
```

Goals and compliance summaries that the effect had to pre-compute
become inline transformers that derive from the raw data:

```rust
pub fn goals_summary(functions: &Functions) -> Value {
    govuk::BODY.build(obj! {
        "text": data("case.goals").pipe([functions
            .register(FunctionEntry::transformer("GoalsSummary", |value, _args| {
                let goals = value.as_array().map(|g| g.to_vec()).unwrap_or_default();
                let achieved = goals.iter().filter(|g| g.get("status").as_str() == Some("ACHIEVED")).count();

                Ok(Value::from(format!("{achieved} of {} goals achieved", goals.len())))
            }))
            .call(vec![])]),
        "classes": "govuk-!-font-weight-bold",
    })
}
```

---

## What the demo shows

The interactive demo renders the same case overview dashboard
twice. Both pages produce identical output from the same data.
Compare the code panels to see the difference:

- The **verbose version** uses `when().then().otherwise()` chains
  repeated for all 6 risk scores, and relies on pre-computed
  values from the effect for goals and compliance
- The **clean version** uses a `risk_row()` helper backed by one
  inline transformer, and derives goals and compliance summaries
  directly from the raw data

{{slot:demo}}

---

## Best practices

- **Keep inline functions short.** If a transformer grows beyond
  10 to 15 lines, extract it into its own module with its own
  tests.
- **Name functions after the output.** `RiskLevelTag` and
  `GoalsSummary` describe what they produce.
- **One collector per package.** Create it where the package is
  assembled and pass it to the block functions. All inline
  functions flow through a single collector for registration.
- **Do not reshape data in effects.** Effects load and save.
  Transformers reshape. Mixing the two ties effects to specific
  component shapes and makes them harder to test.
