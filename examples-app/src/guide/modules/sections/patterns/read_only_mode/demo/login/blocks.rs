//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/read-only-mode/demo/login/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


pub fn heading() -> D {
    component(&govuk::HEADING, obj! { "text": "Log in", "size": "l" })
}

pub fn intro() -> D {
    component(&govuk::BODY, obj! {
        "text": "Pick a role to simulate logging in. Admins can edit the contact record. Viewers can only view it.",
    })
}

pub fn admin_button() -> D {
    component(&govuk::BUTTON, obj! { "text": "Log in as Admin", "name": "action", "value": "login-admin" })
}

pub fn viewer_button() -> D {
    component(&govuk::BUTTON, obj! {
        "text": "Log in as Viewer",
        "name": "action",
        "value": "login-viewer",
        "classes": "govuk-button--secondary",
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = heading();
        let _ = intro();
        let _ = admin_button();
        let _ = viewer_button();
    });
}
