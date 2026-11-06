//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/collection-validation/demo/manage-plan/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


pub fn heading() -> D {
    component(&govuk::HEADING, obj! { "text": "Add actions to goals", "size": "l", "caption": "Collection validation demo" })
}

pub fn intro() -> D {
    component(&govuk::BODY, obj! {
        "text": "Each active goal needs at least one action before the plan can be agreed. Add an action to each goal below.",
    })
}

pub fn goal_actions() -> D {
    component(&core_blocks::COLLECTION_BLOCK, obj! {
        "collection": data("activeGoals").each(iterator::map(arr![
            component(&govuk::HEADING, obj! { "text": item().path("title"), "size": "s" }),
            component(&govuk::TEXT_INPUT, obj! {
                "code": format("action_%1", vec![Loop.index0()]),
                "label": obj! { "text": "Action" },
                "hint": obj! { "text": "Describe what needs to happen to achieve this goal" },
            }),
        ])),
        "fallback": arr![component(&govuk::BODY, obj! { "text": "No active goals to manage." })],
    })
}

pub fn continue_button() -> D {
    component(&govuk::BUTTON, obj! { "text": "Save and continue" })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = heading();
        let _ = intro();
        let _ = goal_actions();
        let _ = continue_button();
    });
}
