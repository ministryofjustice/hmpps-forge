//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/task-list/demo/journey.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::task_list::demo::additional_needs::step::additional_needs_step;
use crate::guide::modules::sections::patterns::task_list::demo::check_answers::step::check_answers_step;
use crate::guide::modules::sections::patterns::task_list::demo::confirmation::step::confirmation_step;
use crate::guide::modules::sections::patterns::task_list::demo::overview::step::overview_step;
use crate::guide::modules::sections::patterns::task_list::demo::tasks::step::tasks_step;
use crate::guide::modules::sections::patterns::task_list::demo::visit_preferences::journey::visit_preferences_journey;
use crate::guide::modules::sections::patterns::task_list::demo::your_details::journey::your_details_journey;

pub fn task_list_demo_journey() -> D {
    journey(obj! {
        "code": "task-list-demo",
        "title": "Task list",
        "path": "/task-list",
        "onAccess": arr![access(obj! {
            "effects": arr![function("FunctionType.Effect", "LoadDraftAnswers", vec![D::from("task-list")])],
        })],
        "steps": arr![
            overview_step(),
            tasks_step(),
            additional_needs_step(),
            check_answers_step(),
            confirmation_step(),
        ],
        "children": arr![your_details_journey(), visit_preferences_journey()],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::task_list::demo::overview::step::__init();
        crate::guide::modules::sections::patterns::task_list::demo::tasks::step::__init();
        crate::guide::modules::sections::patterns::task_list::demo::your_details::journey::__init();
        crate::guide::modules::sections::patterns::task_list::demo::visit_preferences::journey::__init();
        crate::guide::modules::sections::patterns::task_list::demo::additional_needs::step::__init();
        crate::guide::modules::sections::patterns::task_list::demo::check_answers::step::__init();
        crate::guide::modules::sections::patterns::task_list::demo::confirmation::step::__init();
        let _ = task_list_demo_journey();
    });
}
