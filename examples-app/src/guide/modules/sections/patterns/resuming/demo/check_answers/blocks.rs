//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/resuming/demo/check-answers/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


pub fn heading() -> D {
    component(&govuk::HEADING, obj! { "text": "Check your answers" })
}

pub fn summary_list() -> D {
    component(&govuk::SUMMARY_LIST, obj! {
        "rows": arr![
            obj! {
                "key": obj! { "text": "Name" },
                "value": obj! { "text": answer("fullName") },
                "actions": obj! {
                    "items": arr![obj! { "href": "your-name", "text": "Change", "visuallyHiddenText": "name" }],
                },
            },
            obj! {
                "key": obj! { "text": "Role" },
                "value": obj! { "text": answer("role") },
                "actions": obj! {
                    "items": arr![obj! { "href": "your-role", "text": "Change", "visuallyHiddenText": "role" }],
                },
            },
        ],
    })
}

pub fn confirm_body() -> D {
    component(&govuk::BODY, obj! { "text": "Selecting \"Confirm\" will save your answers." })
}

pub fn submit_button() -> D {
    component(&govuk::BUTTON, obj! { "text": "Confirm", "name": "action", "value": "confirm" })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = heading();
        let _ = summary_list();
        let _ = confirm_body();
        let _ = submit_button();
    });
}
