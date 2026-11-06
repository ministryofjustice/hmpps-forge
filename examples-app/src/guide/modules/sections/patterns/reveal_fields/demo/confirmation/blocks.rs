//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/reveal-fields/demo/confirmation/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


pub fn panel() -> D {
    component(&govuk::PANEL, obj! { "titleText": "Thanks for letting us know" })
}

pub fn next_steps() -> D {
    component(&govuk::BODY, obj! {
        "text": "Your answers have been stored in the session. Restart the pattern to clear them and try a different option.",
    })
}

pub fn restart_button() -> D {
    component(&govuk::BUTTON, obj! {
        "text": "Restart pattern",
        "name": "action",
        "value": "restart",
        "classes": "govuk-button--secondary",
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = panel();
        let _ = next_steps();
        let _ = restart_button();
    });
}
