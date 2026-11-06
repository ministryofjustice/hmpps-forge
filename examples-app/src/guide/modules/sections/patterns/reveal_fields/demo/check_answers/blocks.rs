//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/reveal-fields/demo/check-answers/blocks.ts`.

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

fn heard_from_label() -> D {
    match_(answer("heardFrom"))
        .branch(condition::equals("search-engine"), "Search engine")
        .branch(condition::equals("social-media"), "Social media")
        .branch(condition::equals("friend-or-colleague"), "Friend or colleague")
        .branch(condition::equals("other"), "Other")
        .otherwise("")
}

pub fn summary_list() -> D {
    component(&govuk::SUMMARY_LIST, obj! {
        "rows": arr![
            obj! {
                "key": obj! { "text": "How you heard about us" },
                "value": obj! { "text": heard_from_label() },
                "actions": obj! {
                    "items": arr![obj! {
                        "href": "heard-from",
                        "text": "Change",
                        "visuallyHiddenText": "how you heard about us",
                    }],
                },
            },
            obj! {
                "key": obj! { "text": "Platform" },
                "value": obj! { "text": answer("socialMediaSource") },
                "actions": obj! {
                    "items": arr![obj! {
                        "href": "heard-from",
                        "text": "Change",
                        "visuallyHiddenText": "the platform",
                    }],
                },
                "visibleWhen": answer("heardFrom").matches(condition::equals("social-media")),
            },
            obj! {
                "key": obj! { "text": "Details" },
                "value": obj! { "text": answer("otherSource") },
                "actions": obj! {
                    "items": arr![obj! {
                        "href": "heard-from",
                        "text": "Change",
                        "visuallyHiddenText": "the details",
                    }],
                },
                "visibleWhen": answer("heardFrom").matches(condition::equals("other")),
            },
        ],
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
        let _ = heard_from_label();
        let _ = summary_list();
        let _ = confirm_body();
        let _ = submit_button();
    });
}
