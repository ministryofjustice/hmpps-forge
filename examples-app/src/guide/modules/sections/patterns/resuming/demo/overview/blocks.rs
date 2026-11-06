//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/resuming/demo/overview/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


fn has_saved_progress() -> D {
    answer("fullName").matches(condition::is_required())
}

pub fn heading() -> D {
    component(&govuk::HEADING, obj! { "text": "Resuming a partially-completed journey", "size": "l", "caption": "Pattern" })
}

pub fn intro() -> D {
    component(&govuk::BODY, obj! {
        "text": "A service that lets users leave and come back later.\n  When the user visits the journey root, Forge picks the step\n  they still need to complete and redirects them there.",
    })
}

pub fn shows() -> D {
    component(&govuk::HEADING, obj! { "text": "What this pattern shows", "size": "s" })
}

pub fn shows_list() -> D {
    component(&govuk::LIST, obj! {
        "items": literal(arr![
            "A `resumeWhen` condition that triggers resume when the user returns with `?resume=true`",
            "Question steps that define where the user goes next after answering",
        ]),
        "style": "bullet",
    })
}

pub fn resume_panel() -> D {
    component(&govuk::INSET_TEXT, obj! {
        "text": "You have saved answers from a previous visit. Clicking\n  continue takes you back to the journey with resume enabled,\n  which redirects you to where you left off.",
        "visibleWhen": has_saved_progress(),
    })
}

pub fn continue_button() -> D {
    component(&govuk::LINK_BUTTON, obj! {
        "text": "Continue where you left off",
        "href": "/forge-developer-guide/patterns/demos/resuming?resume=true",
        "visibleWhen": has_saved_progress(),
    })
}

pub fn start_button() -> D {
    component(&govuk::LINK_BUTTON, obj! {
        "text": "Start the pattern",
        "href": "/forge-developer-guide/patterns/demos/resuming/your-name",
        "isStartButton": true,
        "visibleWhen": not(has_saved_progress()),
    })
}

pub fn scenarios_heading() -> D {
    component(&govuk::HEADING, obj! { "text": "Try different resume states", "size": "s" })
}

pub fn seed_partial_button() -> D {
    component(&govuk::BUTTON, obj! {
        "text": "Seed partial progress",
        "name": "action",
        "value": "seed-partial",
        "classes": "govuk-button--secondary",
    })
}

pub fn seed_complete_button() -> D {
    component(&govuk::BUTTON, obj! {
        "text": "Seed complete progress",
        "name": "action",
        "value": "seed-complete",
        "classes": "govuk-button--secondary",
    })
}

pub fn clear_button() -> D {
    component(&govuk::BUTTON, obj! {
        "text": "Clear saved answers",
        "name": "action",
        "value": "clear",
        "classes": "govuk-button--warning",
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = has_saved_progress();
        let _ = heading();
        let _ = intro();
        let _ = shows();
        let _ = shows_list();
        let _ = resume_panel();
        let _ = continue_button();
        let _ = start_button();
        let _ = scenarios_heading();
        let _ = seed_partial_button();
        let _ = seed_complete_button();
        let _ = clear_button();
    });
}
