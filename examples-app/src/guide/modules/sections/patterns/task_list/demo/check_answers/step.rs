//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/task-list/demo/check-answers/step.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::task_list::demo::check_answers::blocks::additional_needs_summary;
use crate::guide::modules::sections::patterns::task_list::demo::check_answers::blocks::confirm_body;
use crate::guide::modules::sections::patterns::task_list::demo::check_answers::blocks::heading;
use crate::guide::modules::sections::patterns::task_list::demo::check_answers::blocks::submit_button;
use crate::guide::modules::sections::patterns::task_list::demo::check_answers::blocks::visit_preferences_summary;
use crate::guide::modules::sections::patterns::task_list::demo::check_answers::blocks::your_details_summary;
use crate::guide::support::pattern_step;

fn all_complete() -> D {
    and(vec![
        answer("yourDetailsStatus").matches(condition::equals("completed")),
        answer("visitPreferencesStatus").matches(condition::equals("completed")),
        answer("additionalNeedsStatus").matches(condition::equals("completed")),
    ])
}

pub fn check_answers_step() -> D {
    pattern_step(obj! {
        "code": "check-answers",
        "path": "/check-answers",
        "title": "Check your answers",
        "reachability": obj! { "entryWhen": all_complete() },
        "backlink": "tasks",
        "blocks": arr![
            heading(),
            your_details_summary(),
            visit_preferences_summary(),
            additional_needs_summary(),
            confirm_body(),
            submit_button(),
        ],
        "onSubmission": arr![submit(obj! {
            "validate": false,
            "onAlways": obj! {
                "effects": arr![
                    function("FunctionType.Effect", "SaveAnswers", vec![D::from("task-list")]),
                    function(
                        "FunctionType.Effect",
                        "SaveSubmitStateToSession",
                        vec![D::from("task-list"), D::from(true)],
                    ),
                    function("FunctionType.Effect", "ClearDraftAnswers", vec![D::from("task-list")]),
                ],
                "next": arr![redirect(obj! {
                    "when": session("patternSubmitted.task-list").matches(condition::equals(true)),
                    "goto": "confirmation",
                })],
            },
        })],
        "sourceBase": "task-list/demo/check-answers",
        "codeFiles": arr!["step.rs", "blocks.rs"],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::task_list::demo::check_answers::blocks::__init();
        let _ = all_complete();
        let _ = check_answers_step();
    });
}
