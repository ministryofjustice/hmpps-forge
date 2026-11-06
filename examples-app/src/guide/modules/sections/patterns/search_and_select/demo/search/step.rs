//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/search-and-select/demo/search/step.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::search_and_select::demo::search::blocks::heading;
use crate::guide::modules::sections::patterns::search_and_select::demo::search::blocks::results_heading;
use crate::guide::modules::sections::patterns::search_and_select::demo::search::blocks::results_list;
use crate::guide::modules::sections::patterns::search_and_select::demo::search::blocks::search_button;
use crate::guide::modules::sections::patterns::search_and_select::demo::search::blocks::search_input;
use crate::guide::support::pattern_step;

pub fn search_step() -> D {
    pattern_step(obj! {
        "code": "search",
        "path": "/search",
        "title": "Search stations",
        "reachability": obj! { "entryWhen": true },
        "onAccess": arr![access(obj! {
            "effects": arr![
                function("FunctionType.Effect", "LoadDraftAnswers", vec![D::from("search-and-select")]),
                function("FunctionType.Effect", "SearchStations", vec![]),
            ],
        })],
        "blocks": arr![
            heading(),
            search_input(),
            search_button(),
            results_heading(),
            results_list(),
        ],
        "onSubmission": arr![submit(obj! {
            "validate": false,
            "onAlways": obj! {
                "effects": arr![function("FunctionType.Effect", "SaveDraftAnswers", vec![D::from("search-and-select")])],
                "next": arr![redirect(obj! { "goto": "search" })],
            },
        })],
        "sourceBase": "search-and-select/demo/search",
        "codeFiles": arr!["step.rs", "blocks.rs"],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::search_and_select::demo::search::blocks::__init();
        let _ = search_step();
    });
}
