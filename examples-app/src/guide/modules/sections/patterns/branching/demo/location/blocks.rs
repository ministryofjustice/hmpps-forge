//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/branching/demo/location/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


pub fn location_field() -> D {
    component(&govuk::RADIO_INPUT, obj! {
        "code": "location",
        "fieldset": obj! {
            "legend": obj! {
                "text": "Which office would you like to visit?",
                "classes": D::from(forge_govuk_components::utility_classes())
                    .get("Fieldset")
                    .get("LargeLabel"),
                "isPageHeading": true,
            },
        },
        "items": arr![
            obj! { "value": "london", "text": "London" },
            obj! { "value": "manchester", "text": "Manchester" },
            obj! { "value": "cardiff", "text": "Cardiff" },
            obj! { "value": "edinburgh", "text": "Edinburgh" },
        ],
        "validWhen": arr![validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Select an office",
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
        let _ = location_field();
        let _ = continue_button();
    });
}
