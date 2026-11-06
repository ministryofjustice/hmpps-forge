//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/pagination/demo/journey.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::pagination::demo::detail::step::detail_step;
use crate::guide::modules::sections::patterns::pagination::demo::list::step::list_step;
use crate::guide::modules::sections::patterns::pagination::demo::overview::step::overview_step;

pub fn pagination_demo_journey() -> D {
    journey(obj! {
        "code": "pagination-demo",
        "title": "Pagination",
        "path": "/pagination",
        "steps": arr![overview_step(), list_step(), detail_step()],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::pagination::demo::overview::step::__init();
        crate::guide::modules::sections::patterns::pagination::demo::list::step::__init();
        crate::guide::modules::sections::patterns::pagination::demo::detail::step::__init();
        let _ = pagination_demo_journey();
    });
}
