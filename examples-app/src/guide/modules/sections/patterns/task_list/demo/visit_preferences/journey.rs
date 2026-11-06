//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/task-list/demo/visit-preferences/journey.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::task_list::demo::visit_preferences::preferred_day::step::preferred_day_step;
use crate::guide::modules::sections::patterns::task_list::demo::visit_preferences::visit_type::step::visit_type_step;

pub fn visit_preferences_journey() -> D {
    journey(obj! {
        "code": "visit-preferences",
        "title": "Visit preferences",
        "path": "/visit-preferences",
        "steps": arr![preferred_day_step(), visit_type_step()],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::task_list::demo::visit_preferences::preferred_day::step::__init();
        crate::guide::modules::sections::patterns::task_list::demo::visit_preferences::visit_type::step::__init();
        let _ = visit_preferences_journey();
    });
}
