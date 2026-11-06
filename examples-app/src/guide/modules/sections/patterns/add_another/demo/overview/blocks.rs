//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/add-another/demo/overview/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


pub fn heading() -> D {
    component(&govuk::HEADING, obj! {
        "text": "Adding, editing and deleting from collections",
        "size": "l",
        "caption": "Pattern",
    })
}

pub fn intro() -> D {
    component(&govuk::BODY, obj! {
        "text": "A list page that lets users build a collection one item\n  at a time. Each item is collected on a separate form page, then\n  displayed as a summary card with change and remove links. The\n  user can add items, edit existing ones, remove items through a\n  confirmation step, or continue to check their answers.",
    })
}

pub fn shows() -> D {
    component(&govuk::HEADING, obj! { "text": "What this pattern shows", "size": "s" })
}

pub fn shows_list() -> D {
    component(&govuk::LIST, obj! {
        "items": literal(arr![
            "A list page that renders items using CollectionBlock and Iterator.Map",
            "An \"Add another\" button that loops back to the form without validation",
            "Change links that pre-fill the edit page from the existing item",
            "Remove links that navigate to a confirmation page before deleting",
            "Submit hooks that route \"add another\" and \"continue\" to different steps",
            "A fallback message when the collection is empty",
        ]),
        "style": "bullet",
    })
}

pub fn start_button() -> D {
    component(&govuk::LINK_BUTTON, obj! {
        "text": "Start the pattern",
        "href": "/forge-developer-guide/patterns/demos/add-another/your-contacts",
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
