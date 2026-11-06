//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/repeating-fieldsets/demo/check-answers/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


pub fn heading() -> D {
    component(&govuk::HEADING, obj! { "text": "Check your answers" })
}

pub fn member_summaries() -> D {
    component(&core_blocks::COLLECTION_BLOCK, obj! {
        "collection": data("members").each(iterator::map(component(&govuk::SUMMARY_LIST, obj! {
            "card": obj! { "title": obj! { "text": item().path("memberName") } },
            "rows": arr![obj! {
                "key": obj! { "text": "Age" },
                "value": obj! { "text": item().path("memberAge") },
            }],
        }))),
        "fallback": arr![],
    })
}

pub fn change_link() -> D {
    component(&govuk::LINK_BUTTON, obj! {
        "text": "Change household members",
        "href": "household-members",
        "classes": "govuk-button--secondary",
    })
}

pub fn confirm_body() -> D {
    component(&govuk::BODY, obj! { "text": "Selecting \"Confirm\" will save your answers." })
}

pub fn submit_button() -> D {
    component(&govuk::BUTTON, obj! { "text": "Confirm" })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = heading();
        let _ = member_summaries();
        let _ = change_link();
        let _ = confirm_body();
        let _ = submit_button();
    });
}
