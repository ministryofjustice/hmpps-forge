//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/auth-role/demo/admin-panel/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


pub fn heading() -> D {
    component(&govuk::HEADING, obj! { "text": "Admin panel", "size": "l" })
}

pub fn body() -> D {
    component(&govuk::BODY, obj! {
        "text": "This page is only accessible to users with the admin role. Viewers who try to access it receive a 403 error.",
    })
}

pub fn back_link() -> D {
    component(&govuk::LINK_BUTTON, obj! {
        "text": "Back to dashboard",
        "href": "/forge-developer-guide/patterns/demos/auth-role/dashboard",
        "classes": "govuk-button--secondary",
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = heading();
        let _ = body();
        let _ = back_link();
    });
}
