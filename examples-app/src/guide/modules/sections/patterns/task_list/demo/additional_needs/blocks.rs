//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/task-list/demo/additional-needs/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


pub fn heading() -> D {
    component(&govuk::HEADING, obj! { "text": "Do you have any additional needs?", "size": "l" })
}

pub fn hint() -> D {
    component(&govuk::BODY, obj! {
        "text": "Tell us about any accessibility requirements, dietary needs, or other support you need during your visit. Enter \"None\" if you have no additional needs.",
    })
}

pub fn additional_needs_field() -> D {
    component(&govuk::TEXTAREA, obj! {
        "code": "additionalNeeds",
        "label": obj! {
            "text": "Additional needs",
            "classes": D::from(forge_govuk_components::utility_classes()).get("Label").get("Medium"),
        },
        "rows": 4.0,
        "validWhen": arr![validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Enter your additional needs or \"None\"",
            "submissionOnly": true,
        })],
    })
}

pub fn continue_button() -> D {
    component(&govuk::BUTTON, obj! { "text": "Save and return" })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = heading();
        let _ = hint();
        let _ = additional_needs_field();
        let _ = continue_button();
    });
}
