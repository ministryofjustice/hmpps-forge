//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/branching/demo/video-email/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


pub fn video_email_field() -> D {
    component(&govuk::TEXT_INPUT, obj! {
        "code": "videoEmail",
        "label": obj! {
            "text": "What email should we send the invite to?",
            "classes": D::from(forge_govuk_components::utility_classes()).get("Label").get("Large"),
            "isPageHeading": true,
        },
        "hint": obj! { "text": "We will send a calendar invite with the video call details." },
        "inputType": "email",
        "autocomplete": "email",
        "classes": D::from(forge_govuk_components::utility_classes()).get("Input").get("Width20"),
        "formatters": arr![transformer::string::trim(), transformer::string::to_lower_case()],
        "validWhen": arr![
            validation(obj! {
                "condition": self_().matches(condition::is_required()),
                "message": "Enter an email address",
            }),
            validation(obj! {
                "condition": self_().matches(condition::email::is_valid_email()),
                "message": "Enter a valid email address",
            }),
        ],
    })
}

pub fn continue_button() -> D {
    component(&govuk::BUTTON, obj! { "text": "Continue" })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = video_email_field();
        let _ = continue_button();
    });
}
