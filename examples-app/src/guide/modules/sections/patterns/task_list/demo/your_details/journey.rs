//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/task-list/demo/your-details/journey.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::task_list::demo::your_details::relationship::step::relationship_step;
use crate::guide::modules::sections::patterns::task_list::demo::your_details::your_name::step::your_name_step;

pub fn your_details_journey() -> D {
    journey(obj! {
        "code": "your-details",
        "title": "Your details",
        "path": "/your-details",
        "steps": arr![your_name_step(), relationship_step()],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::task_list::demo::your_details::your_name::step::__init();
        crate::guide::modules::sections::patterns::task_list::demo::your_details::relationship::step::__init();
        let _ = your_details_journey();
    });
}
