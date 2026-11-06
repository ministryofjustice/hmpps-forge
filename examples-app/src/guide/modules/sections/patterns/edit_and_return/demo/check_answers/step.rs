//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/edit-and-return/demo/check-answers/step.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::edit_and_return::demo::check_answers::blocks::confirm_body;
use crate::guide::modules::sections::patterns::edit_and_return::demo::check_answers::blocks::heading;
use crate::guide::modules::sections::patterns::edit_and_return::demo::check_answers::blocks::submit_button;
use crate::guide::modules::sections::patterns::edit_and_return::demo::check_answers::blocks::summary_list;
use crate::guide::support::pattern_step;

pub fn check_answers_step() -> D {
    pattern_step(obj! {
        "code": "check-answers",
        "path": "/check-answers",
        "title": "Check your answers",
        "blocks": arr![heading(), summary_list(), confirm_body(), submit_button()],
        "onSubmission": arr![submit(obj! {
            "validate": false,
            "onAlways": obj! {
                "effects": arr![
                    function("FunctionType.Effect", "SaveAnswers", vec![D::from("edit-and-return")]),
                    function(
                        "FunctionType.Effect",
                        "SaveSubmitStateToSession",
                        vec![D::from("edit-and-return"), D::from(true)],
                    ),
                    function("FunctionType.Effect", "ClearDraftAnswers", vec![D::from("edit-and-return")]),
                ],
                "next": arr![redirect(obj! {
                    "when": session("patternSubmitted.edit-and-return").matches(
                        condition::equals(true),
                    ),
                    "goto": "confirmation",
                })],
            },
        })],
        "sourceBase": "edit-and-return/demo/check-answers",
        "codeFiles": arr!["step.rs", "blocks.rs"],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::edit_and_return::demo::check_answers::blocks::__init();
        let _ = check_answers_step();
    });
}
