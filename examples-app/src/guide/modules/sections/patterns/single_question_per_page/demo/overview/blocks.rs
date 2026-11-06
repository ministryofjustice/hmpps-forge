//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/single-question-per-page/demo/overview/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


pub fn heading() -> D {
    component(&govuk::HEADING, obj! { "text": "Single question per page", "size": "l", "caption": "Pattern" })
}

pub fn intro() -> D {
    component(&govuk::BODY, obj! {
        "text": "A sequential flow that asks one question per page. Each submission is validated,\n  then the user progresses to the next question. A check-your-answers page lets\n  them review and change individual answers before confirming.",
    })
}

pub fn shows() -> D {
    component(&govuk::HEADING, obj! { "text": "What this pattern shows", "size": "s" })
}

pub fn shows_list() -> D {
    component(&govuk::LIST, obj! {
        "items": literal(arr![
            "One field per step with a form-level Continue button",
            "Validation rules on every submission, with inline error messages",
            "Answers persisted between steps using the session",
            "A summary page with \"Change\" links that return the user to the original step",
            "A final confirmation panel after submission",
        ]),
        "style": "bullet",
    })
}

pub fn start_button() -> D {
    component(&govuk::LINK_BUTTON, obj! {
        "text": "Start the pattern",
        "href": "/forge-developer-guide/patterns/demos/single-question-per-page/your-name",
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
