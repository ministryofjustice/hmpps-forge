//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/inline-functions/demo/before/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


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
            obj! {
                "key": obj! { "text": "Overall" },
                "value": obj! {
                    "html": when(data("case.riskScores.overall").matches(condition::equals("VERY_HIGH")))
                        .then("<strong class=\"govuk-tag govuk-tag--red\">Very high</strong>")
                        .else_(when(data("case.riskScores.overall").matches(condition::equals("HIGH")))
                            .then("<strong class=\"govuk-tag govuk-tag--red\">High</strong>")
                            .else_(when(data("case.riskScores.overall").matches(condition::equals("MEDIUM")))
                                .then(
                                    "<strong class=\"govuk-tag govuk-tag--yellow\">Medium</strong>",
                                )
                                .else_("<strong class=\"govuk-tag govuk-tag--green\">Low</strong>"))),
                },
            },
            obj! {
                "key": obj! { "text": "Self-harm" },
                "value": obj! {
                    "html": when(data("case.riskScores.selfHarm").matches(condition::equals("VERY_HIGH")))
                        .then("<strong class=\"govuk-tag govuk-tag--red\">Very high</strong>")
                        .else_(when(data("case.riskScores.selfHarm").matches(condition::equals("HIGH")))
                            .then("<strong class=\"govuk-tag govuk-tag--red\">High</strong>")
                            .else_(when(data("case.riskScores.selfHarm").matches(condition::equals("MEDIUM")))
                                .then(
                                    "<strong class=\"govuk-tag govuk-tag--yellow\">Medium</strong>",
                                )
                                .else_("<strong class=\"govuk-tag govuk-tag--green\">Low</strong>"))),
                },
            },
            obj! {
                "key": obj! { "text": "Public protection" },
                "value": obj! {
                    "html": when(data("case.riskScores.publicProtection").matches(condition::equals("VERY_HIGH")))
                        .then("<strong class=\"govuk-tag govuk-tag--red\">Very high</strong>")
                        .else_(when(data("case.riskScores.publicProtection").matches(condition::equals("HIGH")))
                            .then("<strong class=\"govuk-tag govuk-tag--red\">High</strong>")
                            .else_(when(data("case.riskScores.publicProtection").matches(condition::equals("MEDIUM")))
                                .then(
                                    "<strong class=\"govuk-tag govuk-tag--yellow\">Medium</strong>",
                                )
                                .else_("<strong class=\"govuk-tag govuk-tag--green\">Low</strong>"))),
                },
            },
            obj! {
                "key": obj! { "text": "Known adult" },
                "value": obj! {
                    "html": when(data("case.riskScores.knownAdult").matches(condition::equals("VERY_HIGH")))
                        .then("<strong class=\"govuk-tag govuk-tag--red\">Very high</strong>")
                        .else_(when(data("case.riskScores.knownAdult").matches(condition::equals("HIGH")))
                            .then("<strong class=\"govuk-tag govuk-tag--red\">High</strong>")
                            .else_(when(data("case.riskScores.knownAdult").matches(condition::equals("MEDIUM")))
                                .then(
                                    "<strong class=\"govuk-tag govuk-tag--yellow\">Medium</strong>",
                                )
                                .else_("<strong class=\"govuk-tag govuk-tag--green\">Low</strong>"))),
                },
            },
            obj! {
                "key": obj! { "text": "Children" },
                "value": obj! {
                    "html": when(data("case.riskScores.children").matches(condition::equals("VERY_HIGH")))
                        .then("<strong class=\"govuk-tag govuk-tag--red\">Very high</strong>")
                        .else_(when(data("case.riskScores.children").matches(condition::equals("HIGH")))
                            .then("<strong class=\"govuk-tag govuk-tag--red\">High</strong>")
                            .else_(when(data("case.riskScores.children").matches(condition::equals("MEDIUM")))
                                .then(
                                    "<strong class=\"govuk-tag govuk-tag--yellow\">Medium</strong>",
                                )
                                .else_("<strong class=\"govuk-tag govuk-tag--green\">Low</strong>"))),
                },
            },
            obj! {
                "key": obj! { "text": "Staff" },
                "value": obj! {
                    "html": when(data("case.riskScores.staff").matches(condition::equals("VERY_HIGH")))
                        .then("<strong class=\"govuk-tag govuk-tag--red\">Very high</strong>")
                        .else_(when(data("case.riskScores.staff").matches(condition::equals("HIGH")))
                            .then("<strong class=\"govuk-tag govuk-tag--red\">High</strong>")
                            .else_(when(data("case.riskScores.staff").matches(condition::equals("MEDIUM")))
                                .then(
                                    "<strong class=\"govuk-tag govuk-tag--yellow\">Medium</strong>",
                                )
                                .else_("<strong class=\"govuk-tag govuk-tag--green\">Low</strong>"))),
                },
            },
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

pub fn goals_summary() -> D {
    component(&govuk::BODY, obj! {
        "text": format("%1 of %2 goals achieved", vec![data("goalsAchieved"), data("goalsTotal")]),
        "classes": "govuk-!-font-weight-bold",
    })
}

pub fn compliance_heading() -> D {
    component(&govuk::HEADING, obj! { "text": "Compliance", "size": "m" })
}

pub fn compliance_summary() -> D {
    component(&govuk::BODY, obj! {
        "text": format("%1% attendance rate", vec![data("complianceRate")]),
        "classes": "govuk-!-font-weight-bold",
    })
}

pub fn next_button() -> D {
    component(&govuk::LINK_BUTTON, obj! {
        "text": "See the refactored version",
        "href": "/forge-developer-guide/patterns/demos/inline-functions/after",
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
        let _ = next_button();
    });
}
