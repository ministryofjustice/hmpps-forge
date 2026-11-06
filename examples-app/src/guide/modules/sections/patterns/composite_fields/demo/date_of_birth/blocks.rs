//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/composite-fields/demo/date-of-birth/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


pub fn date_of_birth_field() -> D {
    component(&govuk::DATE_INPUT_FULL, obj! {
        "code": "dateOfBirth",
        "fieldset": obj! {
            "legend": obj! {
                "text": "What is your date of birth?",
                "classes": D::from(forge_govuk_components::utility_classes())
                    .get("Fieldset")
                    .get("LargeLabel"),
                "isPageHeading": true,
            },
        },
        "hint": obj! { "text": "For example, 27 3 1990" },
        "validWhen": spread_array(vec![(true, D::from(forge_govuk_components::validations::date_input_full(obj! {
            "empty": obj! { "message": "Enter your date of birth" },
            "missingDay": obj! { "message": "Date of birth must include a day" },
            "missingMonth": obj! { "message": "Date of birth must include a month" },
            "missingYear": obj! { "message": "Date of birth must include a year" },
            "invalid": obj! { "message": "Date of birth must be a real date" },
            "mustBePast": obj! {
                "message": "Date of birth must be in the past",
                "submissionOnly": true,
            },
        }.into_value())))]),
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
        let _ = date_of_birth_field();
        let _ = continue_button();
    });
}
