//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/branching/demo/check-answers/blocks.ts`.

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

fn visit_type_label() -> D {
    match_(answer("visitType"))
        .branch(condition::equals("in-person"), "In person")
        .branch(condition::equals("video"), "Video call")
        .branch(condition::equals("phone"), "Phone call")
        .otherwise("")
}

pub fn summary_list() -> D {
    component(&govuk::SUMMARY_LIST, obj! {
        "rows": arr![
            obj! {
                "key": obj! { "text": "How you would like to meet" },
                "value": obj! { "text": visit_type_label() },
                "actions": obj! {
                    "items": arr![obj! {
                        "href": "visit-type",
                        "text": "Change",
                        "visuallyHiddenText": "how you would like to meet",
                    }],
                },
            },
            obj! {
                "visibleWhen": answer("visitType").matches(condition::equals("in-person")),
                "key": obj! { "text": "Office" },
                "value": obj! {
                    "text": answer("location").pipe(vec![D::from(transformer::string::capitalize())]),
                },
                "actions": obj! {
                    "items": arr![obj! { "href": "location", "text": "Change", "visuallyHiddenText": "office" }],
                },
            },
            obj! {
                "visibleWhen": answer("visitType").matches(condition::equals("video")),
                "key": obj! { "text": "Invite email" },
                "value": obj! { "text": answer("videoEmail") },
                "actions": obj! {
                    "items": arr![obj! {
                        "href": "video-email",
                        "text": "Change",
                        "visuallyHiddenText": "invite email",
                    }],
                },
            },
            obj! {
                "visibleWhen": answer("visitType").matches(condition::equals("phone")),
                "key": obj! { "text": "Phone number" },
                "value": obj! { "text": answer("phoneNumber") },
                "actions": obj! {
                    "items": arr![obj! {
                        "href": "phone-number",
                        "text": "Change",
                        "visuallyHiddenText": "phone number",
                    }],
                },
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
        let _ = visit_type_label();
        let _ = summary_list();
        let _ = confirm_body();
        let _ = submit_button();
    });
}
