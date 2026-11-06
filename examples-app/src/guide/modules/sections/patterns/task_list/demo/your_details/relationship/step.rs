//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/task-list/demo/your-details/relationship/step.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::task_list::demo::your_details::relationship::blocks::continue_button;
use crate::guide::modules::sections::patterns::task_list::demo::your_details::relationship::blocks::heading;
use crate::guide::modules::sections::patterns::task_list::demo::your_details::relationship::blocks::relationship_field;
use crate::guide::support::pattern_step;

pub fn relationship_step() -> D {
    pattern_step(obj! {
        "code": "relationship",
        "path": "/relationship",
        "title": "Relationship",
        "blocks": arr![heading(), relationship_field(), continue_button()],
        "onSubmission": arr![submit(obj! {
            "validate": true,
            "onValid": obj! {
                "effects": arr![
                    function("FunctionType.Effect", "SetAnswer", vec![D::from("yourDetailsStatus"), D::from("completed")]),
                    function("FunctionType.Effect", "SaveDraftAnswers", vec![D::from("task-list")]),
                ],
                "next": arr![redirect(obj! { "goto": "../tasks" })],
            },
        })],
        "sourceBase": "task-list/demo/your-details/relationship",
        "codeFiles": arr!["step.rs", "blocks.rs"],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::task_list::demo::your_details::relationship::blocks::__init();
        let _ = relationship_step();
    });
}
