//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/reveal-fields/demo/heard-from/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


pub fn heard_from_field() -> D {
    component(&govuk::RADIO_INPUT, obj! {
        "code": "heardFrom",
        "fieldset": obj! {
            "legend": obj! {
                "text": "How did you hear about us?",
                "classes": D::from(forge_govuk_components::utility_classes())
                    .get("Fieldset")
                    .get("LargeLabel"),
                "isPageHeading": true,
            },
        },
        "items": arr![
            obj! { "value": "search-engine", "text": "Search engine" },
            obj! {
                "value": "social-media",
                "text": "Social media",
                "block": component(&govuk::TEXT_INPUT, obj! {
                    "code": "socialMediaSource",
                    "label": "Which platform?",
                    "dependentWhen": answer("heardFrom").matches(condition::equals("social-media")),
                    "classes": D::from(forge_govuk_components::utility_classes())
                        .get("Input")
                        .get("Width20"),
                    "formatters": arr![transformer::string::trim()],
                    "validWhen": arr![validation(obj! {
                        "condition": self_().matches(condition::is_required()),
                        "message": "Enter the platform where you saw us",
                    })],
                }),
            },
            obj! { "value": "friend-or-colleague", "text": "Friend or colleague" },
            obj! {
                "value": "other",
                "text": "Other",
                "block": component(&govuk::TEXT_INPUT, obj! {
                    "code": "otherSource",
                    "label": "Please specify",
                    "dependentWhen": answer("heardFrom").matches(condition::equals("other")),
                    "classes": D::from(forge_govuk_components::utility_classes())
                        .get("Input")
                        .get("Width20"),
                    "formatters": arr![transformer::string::trim()],
                    "validWhen": arr![validation(obj! {
                        "condition": self_().matches(condition::is_required()),
                        "message": "Enter where you heard about us",
                    })],
                }),
            },
        ],
        "validWhen": arr![validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Select how you heard about us",
        })],
    })
}

pub fn continue_button() -> D {
    component(&govuk::BUTTON, obj! { "text": "Continue" })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = heard_from_field();
        let _ = continue_button();
    });
}
