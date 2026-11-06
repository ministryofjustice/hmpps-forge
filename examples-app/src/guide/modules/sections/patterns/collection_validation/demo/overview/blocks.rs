//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/collection-validation/demo/overview/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


pub fn heading() -> D {
    component(&govuk::HEADING, obj! { "text": "Validating collections with iterators", "size": "l", "caption": "Pattern" })
}

pub fn intro() -> D {
    component(&govuk::BODY, obj! {
        "text": "A plan has a list of goals loaded from an API. Each active goal\n  must have at least one action before the plan can be agreed. The\n  validWhen array uses Iterator.Filter and Iterator.Map to produce a\n  separate error message per goal that is missing actions.",
    })
}

pub fn shows() -> D {
    component(&govuk::HEADING, obj! { "text": "What this pattern shows", "size": "s" })
}

pub fn shows_list() -> D {
    component(&govuk::LIST, obj! {
        "items": literal(arr![
            "An iterator chain as a validation condition: filter then count",
            "An iterate that yields validation() expressions for per-item error messages",
            "Mixing standard field validation with data-driven collection validation on the same field",
        ]),
        "style": "bullet",
    })
}

pub fn start_button() -> D {
    component(&govuk::LINK_BUTTON, obj! {
        "text": "Start the pattern",
        "href": "/forge-developer-guide/patterns/demos/collection-validation/agree-plan",
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
