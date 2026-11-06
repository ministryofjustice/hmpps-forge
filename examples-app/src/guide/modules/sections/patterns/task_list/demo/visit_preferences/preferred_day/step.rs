//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/task-list/demo/visit-preferences/preferred-day/step.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::task_list::demo::visit_preferences::preferred_day::blocks::continue_button;
use crate::guide::modules::sections::patterns::task_list::demo::visit_preferences::preferred_day::blocks::day_field;
use crate::guide::modules::sections::patterns::task_list::demo::visit_preferences::preferred_day::blocks::heading;
use crate::guide::support::pattern_step;

pub fn preferred_day_step() -> D {
    pattern_step(obj! {
        "code": "preferred-day",
        "path": "/preferred-day",
        "title": "Preferred day",
        "reachability": obj! { "entryWhen": true },
        "backlink": "../tasks",
        "blocks": arr![heading(), day_field(), continue_button()],
        "onSubmission": arr![submit(obj! {
            "validate": true,
            "onValid": obj! {
                "effects": arr![
                    function("FunctionType.Effect", "SetAnswer", vec![D::from("visitPreferencesStatus"), D::from("in-progress")]),
                    function("FunctionType.Effect", "SaveDraftAnswers", vec![D::from("task-list")]),
                ],
                "next": arr![redirect(obj! { "goto": "visit-type" })],
            },
        })],
        "sourceBase": "task-list/demo/visit-preferences/preferred-day",
        "codeFiles": arr!["step.rs", "blocks.rs"],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::task_list::demo::visit_preferences::preferred_day::blocks::__init();
        let _ = preferred_day_step();
    });
}
