//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/repeating-fieldsets/demo/check-answers/step.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::repeating_fieldsets::demo::check_answers::blocks::change_link;
use crate::guide::modules::sections::patterns::repeating_fieldsets::demo::check_answers::blocks::confirm_body;
use crate::guide::modules::sections::patterns::repeating_fieldsets::demo::check_answers::blocks::heading;
use crate::guide::modules::sections::patterns::repeating_fieldsets::demo::check_answers::blocks::member_summaries;
use crate::guide::modules::sections::patterns::repeating_fieldsets::demo::check_answers::blocks::submit_button;
use crate::guide::support::pattern_step;

fn pattern_code() -> D {
    D::from("repeating-fieldsets")
}

fn collection_code() -> D {
    D::from("members")
}

fn field_codes() -> D {
    arr!["memberName", "memberAge"]
}

pub fn check_answers_step() -> D {
    pattern_step(obj! {
        "code": "check-answers",
        "path": "/check-answers",
        "title": "Check your answers",
        "blocks": arr![
            heading(),
            member_summaries(),
            change_link(),
            confirm_body(),
            submit_button(),
        ],
        "onAccess": arr![access(obj! {
            "effects": arr![function("FunctionType.Effect", "InitializeRepeatingFieldsets", vec![pattern_code(), collection_code(), field_codes()])],
        })],
        "onSubmission": arr![submit(obj! {
            "validate": false,
            "onAlways": obj! {
                "effects": arr![
                    function("FunctionType.Effect", "SaveAnswers", vec![pattern_code()]),
                    function(
                        "FunctionType.Effect",
                        "SaveSubmitStateToSession",
                        vec![pattern_code(), D::from(true)],
                    ),
                ],
                "next": arr![redirect(obj! {
                    "when": session(template(vec![D::from("patternSubmitted."), pattern_code(), D::from("")])).matches(
                        condition::equals(true),
                    ),
                    "goto": "confirmation",
                })],
            },
        })],
        "sourceBase": "repeating-fieldsets/demo/check-answers",
        "codeFiles": arr!["step.rs", "blocks.rs"],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::repeating_fieldsets::demo::check_answers::blocks::__init();
        let _ = pattern_code();
        let _ = collection_code();
        let _ = field_codes();
        let _ = check_answers_step();
    });
}
