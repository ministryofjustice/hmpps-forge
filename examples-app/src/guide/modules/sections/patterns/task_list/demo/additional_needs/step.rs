//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/task-list/demo/additional-needs/step.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::task_list::demo::additional_needs::blocks::additional_needs_field;
use crate::guide::modules::sections::patterns::task_list::demo::additional_needs::blocks::continue_button;
use crate::guide::modules::sections::patterns::task_list::demo::additional_needs::blocks::heading;
use crate::guide::modules::sections::patterns::task_list::demo::additional_needs::blocks::hint;
use crate::guide::support::pattern_step;

fn prerequisites_met() -> D {
    and(vec![answer("yourDetailsStatus").matches(condition::equals("completed")), answer("visitPreferencesStatus").matches(condition::equals("completed"))])
}

pub fn additional_needs_step() -> D {
    pattern_step(obj! {
        "code": "additional-needs",
        "path": "/additional-needs",
        "title": "Additional needs",
        "reachability": obj! { "entryWhen": prerequisites_met() },
        "backlink": "tasks",
        "blocks": arr![heading(), hint(), additional_needs_field(), continue_button()],
        "onSubmission": arr![submit(obj! {
            "validate": true,
            "onValid": obj! {
                "effects": arr![
                    function("FunctionType.Effect", "SetAnswer", vec![D::from("additionalNeedsStatus"), D::from("completed")]),
                    function("FunctionType.Effect", "SaveDraftAnswers", vec![D::from("task-list")]),
                ],
                "next": arr![redirect(obj! { "goto": "tasks" })],
            },
        })],
        "sourceBase": "task-list/demo/additional-needs",
        "codeFiles": arr!["step.rs", "blocks.rs"],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::task_list::demo::additional_needs::blocks::__init();
        let _ = prerequisites_met();
        let _ = additional_needs_step();
    });
}
