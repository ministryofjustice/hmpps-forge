//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/branching/demo/phone-number/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


pub fn phone_number_field() -> D {
    component(&govuk::TEXT_INPUT, obj! {
        "code": "phoneNumber",
        "label": obj! {
            "text": "What number should we call you on?",
            "classes": D::from(forge_govuk_components::utility_classes()).get("Label").get("Large"),
            "isPageHeading": true,
        },
        "inputType": "tel",
        "autocomplete": "tel",
        "classes": D::from(forge_govuk_components::utility_classes()).get("Input").get("Width20"),
        "formatters": arr![transformer::string::trim()],
        "validWhen": arr![
            validation(obj! {
                "condition": self_().matches(condition::is_required()),
                "message": "Enter a phone number",
            }),
            validation(obj! {
                "condition": self_().matches(condition::phone::is_valid_phone_number()),
                "message": "Enter a valid phone number",
            }),
        ],
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
        let _ = phone_number_field();
        let _ = continue_button();
    });
}
