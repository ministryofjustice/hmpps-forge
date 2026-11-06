//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/task-list/demo/check-answers/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


pub fn heading() -> D {
    component(&govuk::HEADING, obj! { "text": "Check your answers", "size": "l" })
}

fn relationship_label() -> D {
    match_(answer("relationship"))
        .branch(condition::equals("partner"), "Partner or spouse")
        .branch(condition::equals("parent"), "Parent")
        .branch(condition::equals("child"), "Son or daughter")
        .branch(condition::equals("sibling"), "Brother or sister")
        .branch(condition::equals("friend"), "Friend")
        .branch(condition::equals("legal"), "Legal representative")
        .branch(condition::equals("other"), "Other")
        .otherwise("")
}

fn day_label() -> D {
    match_(answer("preferredDay"))
        .branch(condition::equals("monday"), "Monday")
        .branch(condition::equals("wednesday"), "Wednesday")
        .branch(condition::equals("friday"), "Friday")
        .branch(condition::equals("saturday"), "Saturday")
        .otherwise("")
}

fn visit_type_label() -> D {
    match_(answer("visitType"))
        .branch(condition::equals("in-person"), "In person")
        .branch(condition::equals("video"), "Video call")
        .otherwise("")
}

pub fn your_details_summary() -> D {
    component(&govuk::SUMMARY_LIST, obj! {
        "card": obj! { "title": obj! { "text": "Your details" } },
        "rows": arr![
            obj! {
                "key": obj! { "text": "Full name" },
                "value": obj! { "text": answer("visitorName") },
                "actions": obj! {
                    "items": arr![obj! {
                        "href": "your-details/your-name",
                        "text": "Change",
                        "visuallyHiddenText": "your name",
                    }],
                },
            },
            obj! {
                "key": obj! { "text": "Relationship" },
                "value": obj! { "text": relationship_label() },
                "actions": obj! {
                    "items": arr![obj! {
                        "href": "your-details/relationship",
                        "text": "Change",
                        "visuallyHiddenText": "your relationship",
                    }],
                },
            },
        ],
    })
}

pub fn visit_preferences_summary() -> D {
    component(&govuk::SUMMARY_LIST, obj! {
        "card": obj! { "title": obj! { "text": "Visit preferences" } },
        "rows": arr![
            obj! {
                "key": obj! { "text": "Preferred day" },
                "value": obj! { "text": day_label() },
                "actions": obj! {
                    "items": arr![obj! {
                        "href": "visit-preferences/preferred-day",
                        "text": "Change",
                        "visuallyHiddenText": "preferred day",
                    }],
                },
            },
            obj! {
                "key": obj! { "text": "Type of visit" },
                "value": obj! { "text": visit_type_label() },
                "actions": obj! {
                    "items": arr![obj! {
                        "href": "visit-preferences/visit-type",
                        "text": "Change",
                        "visuallyHiddenText": "type of visit",
                    }],
                },
            },
        ],
    })
}

pub fn additional_needs_summary() -> D {
    component(&govuk::SUMMARY_LIST, obj! {
        "card": obj! { "title": obj! { "text": "Additional needs" } },
        "rows": arr![obj! {
            "key": obj! { "text": "Requirements" },
            "value": obj! { "text": answer("additionalNeeds") },
            "actions": obj! {
                "items": arr![obj! {
                    "href": "additional-needs",
                    "text": "Change",
                    "visuallyHiddenText": "additional needs",
                }],
            },
        }],
    })
}

pub fn confirm_body() -> D {
    component(&govuk::BODY, obj! {
        "text": "By submitting this application you confirm that the information you have provided is correct.",
    })
}

pub fn submit_button() -> D {
    component(&govuk::BUTTON, obj! { "text": "Submit application" })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = heading();
        let _ = relationship_label();
        let _ = day_label();
        let _ = visit_type_label();
        let _ = your_details_summary();
        let _ = visit_preferences_summary();
        let _ = additional_needs_summary();
        let _ = confirm_body();
        let _ = submit_button();
    });
}
