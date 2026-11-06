//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/task-list/demo/your-details/your-name/step.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::task_list::demo::your_details::your_name::blocks::continue_button;
use crate::guide::modules::sections::patterns::task_list::demo::your_details::your_name::blocks::heading;
use crate::guide::modules::sections::patterns::task_list::demo::your_details::your_name::blocks::name_field;
use crate::guide::support::pattern_step;

pub fn your_name_step() -> D {
    pattern_step(obj! {
        "code": "your-name",
        "path": "/your-name",
        "title": "Your name",
        "reachability": obj! { "entryWhen": true },
        "backlink": "../tasks",
        "blocks": arr![heading(), name_field(), continue_button()],
        "onSubmission": arr![submit(obj! {
            "validate": true,
            "onValid": obj! {
                "effects": arr![
                    function("FunctionType.Effect", "SetAnswer", vec![D::from("yourDetailsStatus"), D::from("in-progress")]),
                    function("FunctionType.Effect", "SaveDraftAnswers", vec![D::from("task-list")]),
                ],
                "next": arr![redirect(obj! { "goto": "relationship" })],
            },
        })],
        "sourceBase": "task-list/demo/your-details/your-name",
        "codeFiles": arr!["step.rs", "blocks.rs"],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::task_list::demo::your_details::your_name::blocks::__init();
        let _ = your_name_step();
    });
}
