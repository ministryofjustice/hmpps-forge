//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/inline-functions/demo/after/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


fn risk_level_tag() -> D {
    func(|args| function("FunctionType.Transformer", "RiskLevelTag", args))
}

#[allow(unused_variables)]
fn risk_row(area: D, ref_: D) -> D {
    D::V(obj! {
        "key": obj! { "text": area.clone() },
        "value": obj! { "html": ref_.clone().pipe(vec![risk_level_tag().call(vec![])]) },
    })
}

pub fn heading() -> D {
    component(&govuk::HEADING, obj! {
        "text": format("%1 %2", vec![data("case.name.firstName"), data("case.name.lastName")]),
        "size": "l",
        "caption": format("CRN: %1", vec![data("case.crn")]),
    })
}

pub fn risk_heading() -> D {
    component(&govuk::HEADING, obj! { "text": "Risk scores", "size": "m" })
}

pub fn risk_scores() -> D {
    component(&govuk::SUMMARY_LIST, obj! {
        "rows": arr![
            risk_row(D::from("Overall"), data("case.riskScores.overall")),
            risk_row(D::from("Self-harm"), data("case.riskScores.selfHarm")),
            risk_row(D::from("Public protection"), data("case.riskScores.publicProtection")),
            risk_row(D::from("Known adult"), data("case.riskScores.knownAdult")),
            risk_row(D::from("Children"), data("case.riskScores.children")),
            risk_row(D::from("Staff"), data("case.riskScores.staff")),
        ],
    })
}

pub fn sentence_heading() -> D {
    component(&govuk::HEADING, obj! { "text": "Sentence", "size": "m" })
}

pub fn sentence_details() -> D {
    component(&govuk::SUMMARY_LIST, obj! {
        "rows": arr![
            obj! {
                "key": obj! { "text": "Type" },
                "value": obj! { "text": data("case.sentence.type") },
            },
            obj! {
                "key": obj! { "text": "Start date" },
                "value": obj! { "text": data("case.sentence.startDate") },
            },
            obj! {
                "key": obj! { "text": "End date" },
                "value": obj! { "text": data("case.sentence.endDate") },
            },
        ],
    })
}

pub fn goals_heading() -> D {
    component(&govuk::HEADING, obj! { "text": "Goals", "size": "m" })
}

fn goals_summary_text() -> D {
    func(|args| function("FunctionType.Transformer", "GoalsSummary", args))
}

pub fn goals_summary() -> D {
    component(&govuk::BODY, obj! {
        "text": data("case.goals").pipe(vec![goals_summary_text().call(vec![])]),
        "classes": "govuk-!-font-weight-bold",
    })
}

pub fn compliance_heading() -> D {
    component(&govuk::HEADING, obj! { "text": "Compliance", "size": "m" })
}

fn compliance_summary_text() -> D {
    func(|args| function("FunctionType.Transformer", "ComplianceSummary", args))
}

pub fn compliance_summary() -> D {
    component(&govuk::BODY, obj! {
        "text": data("case.compliance").pipe(vec![compliance_summary_text().call(vec![])]),
        "classes": "govuk-!-font-weight-bold",
    })
}

pub fn back_button() -> D {
    component(&govuk::LINK_BUTTON, obj! {
        "text": "Back to the verbose version",
        "href": "/forge-developer-guide/patterns/demos/inline-functions/before",
        "classes": "govuk-button--secondary",
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = heading();
        let _ = risk_heading();
        let _ = risk_scores();
        let _ = sentence_heading();
        let _ = sentence_details();
        let _ = goals_heading();
        let _ = goals_summary();
        let _ = compliance_heading();
        let _ = compliance_summary();
        let _ = back_button();
    });
}
