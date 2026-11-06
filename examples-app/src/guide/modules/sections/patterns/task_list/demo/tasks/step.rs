//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/task-list/demo/tasks/step.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::task_list::demo::tasks::blocks::heading;
use crate::guide::modules::sections::patterns::task_list::demo::tasks::blocks::intro;
use crate::guide::modules::sections::patterns::task_list::demo::tasks::blocks::task_list;
use crate::guide::support::pattern_step;

pub fn tasks_step() -> D {
    pattern_step(obj! {
        "code": "tasks",
        "path": "/tasks",
        "title": "Book a prison visit",
        "reachability": obj! { "entryWhen": true },
        "blocks": arr![heading(), intro(), task_list()],
        "sourceBase": "task-list/demo/tasks",
        "codeFiles": arr!["step.rs", "blocks.rs"],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::task_list::demo::tasks::blocks::__init();
        let _ = tasks_step();
    });
}
