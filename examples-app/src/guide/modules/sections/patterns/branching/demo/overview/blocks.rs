//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/branching/demo/overview/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


pub fn heading() -> D {
    component(&govuk::HEADING, obj! { "text": "Branching based on an earlier answer", "size": "l", "caption": "Pattern" })
}

pub fn intro() -> D {
    component(&govuk::BODY, obj! {
        "text": "A sequential flow that routes the user down a different\n  path based on an earlier answer. In this demo they pick how\n  they want a visit to happen, and the next page asks only for\n  the details relevant to that choice. All branches converge\n  on a shared check-your-answers summary.",
    })
}

pub fn shows() -> D {
    component(&govuk::HEADING, obj! { "text": "What this pattern shows", "size": "s" })
}

pub fn shows_list() -> D {
    component(&govuk::LIST, obj! {
        "items": literal(arr![
            "A radio question whose answer drives the next step",
            "Conditional redirects in a submit hook's next array, with first-match semantics",
            "Three branch steps that each collect different information",
            "A summary whose key, value, and change link adapt to the branch the user took",
            "A confirmation panel that resets the pattern when revisited",
        ]),
        "style": "bullet",
    })
}

pub fn start_button() -> D {
    component(&govuk::LINK_BUTTON, obj! {
        "text": "Start the pattern",
        "href": "/forge-developer-guide/patterns/demos/branching/visit-type",
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
