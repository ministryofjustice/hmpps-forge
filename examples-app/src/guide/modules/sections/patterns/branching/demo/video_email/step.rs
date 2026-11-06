//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/branching/demo/video-email/step.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::branching::demo::video_email::blocks::continue_button;
use crate::guide::modules::sections::patterns::branching::demo::video_email::blocks::video_email_field;
use crate::guide::support::pattern_step;

pub fn video_email_step() -> D {
    pattern_step(obj! {
        "code": "video-email",
        "path": "/video-email",
        "title": "What email should we send the invite to?",
        "blocks": arr![video_email_field(), continue_button()],
        "onSubmission": arr![submit(obj! {
            "validate": true,
            "onValid": obj! {
                "effects": arr![function("FunctionType.Effect", "SaveDraftAnswers", vec![D::from("branching")])],
                "next": arr![redirect(obj! { "goto": "check-answers" })],
            },
        })],
        "sourceBase": "branching/demo/video-email",
        "codeFiles": arr!["step.rs", "blocks.rs"],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::branching::demo::video_email::blocks::__init();
        let _ = video_email_step();
    });
}
