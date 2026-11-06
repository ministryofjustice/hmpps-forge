//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/repeating-fieldsets/demo/overview/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


pub fn heading() -> D {
    component(&govuk::HEADING, obj! { "text": "Repeating fieldsets", "size": "l", "caption": "Pattern" })
}

pub fn intro() -> D {
    component(&govuk::BODY, obj! {
        "text": "A single page that collects a variable number of items through\n  repeating groups of form fields. Each \"Add another\" press appends a new\n  set of empty inputs. All items are editable simultaneously and submitted\n  together.",
    })
}

pub fn shows() -> D {
    component(&govuk::HEADING, obj! { "text": "What this pattern shows", "size": "s" })
}

pub fn shows_list() -> D {
    component(&govuk::LIST, obj! {
        "items": literal(arr![
            "Form inputs inside an Iterator.Map with dynamic field codes",
            "A non-validating submit hook that appends an empty item and re-renders the page",
            "A remove submit hook that splices an item and re-indexes the remaining fields",
            "Session-backed collection state that survives page reloads",
        ]),
        "style": "bullet",
    })
}

pub fn start_button() -> D {
    component(&govuk::LINK_BUTTON, obj! {
        "text": "See the demo",
        "href": "/forge-developer-guide/patterns/demos/repeating-fieldsets/household-members",
        "isStartButton": true,
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = heading();
        let _ = intro();
        let _ = shows();
        let _ = shows_list();
        let _ = start_button();
    });
}
