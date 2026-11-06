//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/branching/demo/visit-type/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


pub fn visit_type_field() -> D {
    component(&govuk::RADIO_INPUT, obj! {
        "code": "visitType",
        "fieldset": obj! {
            "legend": obj! {
                "text": "How would you like to meet?",
                "classes": D::from(forge_govuk_components::utility_classes())
                    .get("Fieldset")
                    .get("LargeLabel"),
                "isPageHeading": true,
            },
        },
        "hint": obj! { "text": "Pick the option that works best for you." },
        "items": arr![
            obj! { "value": "in-person", "text": "In person" },
            obj! { "value": "video", "text": "Video call" },
            obj! { "value": "phone", "text": "Phone call" },
        ],
        "validWhen": arr![validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Select how you would like to meet",
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
        let _ = visit_type_field();
        let _ = continue_button();
    });
}
