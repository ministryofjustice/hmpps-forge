use forge_core::authoring::*;
use forge_core::{FunctionEntry, Value, obj};
use forge_govuk_components::blocks as govuk;

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

pub fn heading() -> Value {
    govuk::HEADING.build(obj! {
        "text": format("%1 %2", [data("case.name.firstName").into(), data("case.name.lastName").into()]),
        "size": "l",
        "caption": format("CRN: %1", [data("case.crn").into()]),
    })
}

pub fn risk_heading() -> Value {
    govuk::HEADING.build(obj! { "text": "Risk scores", "size": "m" })
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

pub fn sentence_heading() -> Value {
    govuk::HEADING.build(obj! { "text": "Sentence", "size": "m" })
}

pub fn sentence_details() -> Value {
    govuk::SUMMARY_LIST.build(obj! {
        "rows": [
            obj! { "key": obj! { "text": "Type" }, "value": obj! { "text": data("case.sentence.type") } },
            obj! { "key": obj! { "text": "Start date" }, "value": obj! { "text": data("case.sentence.startDate") } },
            obj! { "key": obj! { "text": "End date" }, "value": obj! { "text": data("case.sentence.endDate") } },
        ],
    })
}

pub fn goals_heading() -> Value {
    govuk::HEADING.build(obj! { "text": "Goals", "size": "m" })
}

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

pub fn compliance_heading() -> Value {
    govuk::HEADING.build(obj! { "text": "Compliance", "size": "m" })
}

pub fn compliance_summary(functions: &Functions) -> Value {
    govuk::BODY.build(obj! {
        "text": data("case.compliance").pipe([functions
            .register(FunctionEntry::transformer("ComplianceSummary", |value, _args| {
                let attended = value.get("attended").as_f64().unwrap_or_default();
                let missed = value.get("missed").as_f64().unwrap_or_default();
                let total = attended + missed;
                let rate = if total > 0.0 { (attended / total * 100.0).round() } else { 0.0 };

                Ok(Value::from(format!("{rate}% attendance rate")))
            }))
            .call(vec![])]),
        "classes": "govuk-!-font-weight-bold",
    })
}

pub fn back_button() -> Value {
    govuk::LINK_BUTTON.build(obj! {
        "text": "Back to the verbose version",
        "href": "/forge-developer-guide/patterns/demos/inline-functions/before",
        "classes": "govuk-button--secondary",
    })
}
