//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/resuming/demo/confirmation/step.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::resuming::demo::confirmation::blocks::next_steps;
use crate::guide::modules::sections::patterns::resuming::demo::confirmation::blocks::panel;
use crate::guide::modules::sections::patterns::resuming::demo::confirmation::blocks::restart_button;
use crate::guide::support::pattern_step;

pub fn confirmation_step() -> D {
    pattern_step(obj! {
        "code": "confirmation",
        "path": "/confirmation",
        "title": "Answers submitted",
        "reachability": obj! {
            "entryWhen": session("patternSubmitted.resuming").matches(condition::equals(true)),
            "tieBreakers": arr![tie_breaker(obj! { "priority": 200.0 })],
        },
        "blocks": arr![panel(), next_steps(), restart_button()],
        "onSubmission": arr![submit(obj! {
            "validate": false,
            "onAlways": obj! {
                "effects": arr![
                    function("FunctionType.Effect", "ClearAnswers", vec![D::from("resuming")]),
                    function("FunctionType.Effect", "ClearDraftAnswers", vec![D::from("resuming")]),
                    function(
                        "FunctionType.Effect",
                        "SaveSubmitStateToSession",
                        vec![D::from("resuming"), D::from(false)],
                    ),
                ],
                "next": arr![redirect(obj! { "goto": "overview" })],
            },
        })],
        "sourceBase": "resuming/demo/confirmation",
        "codeFiles": arr!["step.rs", "blocks.rs"],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::resuming::demo::confirmation::blocks::__init();
        let _ = confirmation_step();
    });
}
