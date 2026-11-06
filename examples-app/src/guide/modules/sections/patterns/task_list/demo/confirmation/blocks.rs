//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/task-list/demo/confirmation/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


pub fn panel() -> D {
    component(&govuk::PANEL, obj! { "titleText": "Application submitted", "text": "Your visit request has been sent." })
}

pub fn what_next() -> D {
    component(&govuk::BODY, obj! {
        "text": "We will review your application and send a confirmation email within 3 working days.",
    })
}

pub fn restart_button() -> D {
    component(&govuk::BUTTON, obj! {
        "text": "Start a new application",
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
        let _ = what_next();
        let _ = restart_button();
    });
}
