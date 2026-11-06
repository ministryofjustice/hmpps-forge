//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/auth-role/demo/dashboard/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


pub fn heading() -> D {
    component(&govuk::HEADING, obj! { "text": "Dashboard", "size": "l" })
}

pub fn welcome_message() -> D {
    component(&govuk::BODY, obj! {
        "text": format("Signed in as %1 (role: %2).", vec![session("demoUser.name"), session("demoUser.role")]),
    })
}

pub fn viewer_warning() -> D {
    component(&govuk::INSET_TEXT, obj! {
        "text": "You are signed in as a viewer. The admin panel will return a raw 403 error page. Use your browser's back button to return here.",
        "visibleWhen": session("demoUser.role").matches(condition::equals("viewer")),
    })
}

pub fn admin_link() -> D {
    component(&govuk::LINK_BUTTON, obj! {
        "text": "Go to admin panel",
        "href": "/forge-developer-guide/patterns/demos/auth-role/admin-panel",
    })
}

pub fn logout_button() -> D {
    component(&govuk::BUTTON, obj! {
        "text": "Log out",
        "name": "action",
        "value": "logout",
        "classes": "govuk-button--secondary",
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = heading();
        let _ = welcome_message();
        let _ = viewer_warning();
        let _ = admin_link();
        let _ = logout_button();
    });
}
