//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/single-question-per-page/demo/your-role/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


pub fn role_field() -> D {
    component(&govuk::TEXT_INPUT, obj! {
        "code": "role",
        "label": obj! {
            "text": "What is your role?",
            "classes": D::from(forge_govuk_components::utility_classes()).get("Label").get("Large"),
            "isPageHeading": true,
        },
        "hint": obj! { "text": "For example, developer, designer, or product manager." },
        "classes": D::from(forge_govuk_components::utility_classes()).get("Input").get("Width30"),
        "formatters": arr![transformer::string::trim()],
        "validWhen": arr![
            validation(obj! {
                "condition": self_().matches(condition::is_required()),
                "message": "Enter your role",
            }),
            validation(obj! {
                "condition": self_().matches(condition::string::has_max_length(100.0)),
                "message": "Role must be 100 characters or less",
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
        let _ = role_field();
        let _ = continue_button();
    });
}
