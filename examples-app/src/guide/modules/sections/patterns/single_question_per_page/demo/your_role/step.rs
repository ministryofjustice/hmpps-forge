//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/single-question-per-page/demo/your-role/step.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::single_question_per_page::demo::your_role::blocks::continue_button;
use crate::guide::modules::sections::patterns::single_question_per_page::demo::your_role::blocks::role_field;
use crate::guide::support::pattern_step;

pub fn your_role_step() -> D {
    pattern_step(obj! {
        "code": "your-role",
        "path": "/your-role",
        "title": "What is your role?",
        "blocks": arr![role_field(), continue_button()],
        "onSubmission": arr![submit(obj! {
            "validate": true,
            "onValid": obj! {
                "effects": arr![function("FunctionType.Effect", "SaveDraftAnswers", vec![D::from("single-question-per-page")])],
                "next": arr![redirect(obj! { "goto": "check-answers" })],
            },
        })],
        "sourceBase": "single-question-per-page/demo/your-role",
        "codeFiles": arr!["step.rs", "blocks.rs"],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::single_question_per_page::demo::your_role::blocks::__init();
        let _ = your_role_step();
    });
}
