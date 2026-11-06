//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/search-and-select/demo/journey.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::search_and_select::demo::log::step::log_step;
use crate::guide::modules::sections::patterns::search_and_select::demo::overview::step::overview_step;
use crate::guide::modules::sections::patterns::search_and_select::demo::search::step::search_step;

pub fn search_and_select_demo_journey() -> D {
    journey(obj! {
        "code": "search-and-select-demo",
        "title": "Search and select",
        "path": "/search-and-select",
        "onAccess": arr![access(obj! {
            "effects": arr![function("FunctionType.Effect", "LoadDraftAnswers", vec![D::from("search-and-select")])],
        })],
        "steps": arr![overview_step(), search_step(), log_step()],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::search_and_select::demo::overview::step::__init();
        crate::guide::modules::sections::patterns::search_and_select::demo::search::step::__init();
        crate::guide::modules::sections::patterns::search_and_select::demo::log::step::__init();
        let _ = search_and_select_demo_journey();
    });
}
