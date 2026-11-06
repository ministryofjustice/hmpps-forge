//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/task-list/demo/visit-preferences/preferred-day/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


pub fn heading() -> D {
    component(&govuk::HEADING, obj! { "text": "Which day would you prefer to visit?", "size": "l" })
}

pub fn day_field() -> D {
    component(&govuk::RADIO_INPUT, obj! {
        "code": "preferredDay",
        "fieldset": obj! {
            "legend": obj! { "text": "Preferred day", "classes": "govuk-fieldset__legend--m" },
        },
        "items": arr![
            obj! { "value": "monday", "text": "Monday" },
            obj! { "value": "wednesday", "text": "Wednesday" },
            obj! { "value": "friday", "text": "Friday" },
            obj! { "value": "saturday", "text": "Saturday" },
        ],
        "validWhen": arr![validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Select a preferred day",
            "submissionOnly": true,
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
        let _ = heading();
        let _ = day_field();
        let _ = continue_button();
    });
}
