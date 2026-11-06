//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/search-and-select/demo/log/step.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::search_and_select::demo::log::blocks::back_button;
use crate::guide::modules::sections::patterns::search_and_select::demo::log::blocks::description;
use crate::guide::modules::sections::patterns::search_and_select::demo::log::blocks::details;
use crate::guide::modules::sections::patterns::search_and_select::demo::log::blocks::heading;
use crate::guide::support::pattern_step;

pub fn log_step() -> D {
    pattern_step(obj! {
        "code": "station",
        "path": "/station/:index",
        "title": "Station details",
        "reachability": obj! { "entryWhen": true },
        "onAccess": arr![access(obj! { "effects": arr![function("FunctionType.Effect", "LoadStation", vec![])] })],
        "blocks": arr![heading(), details(), description(), back_button()],
        "sourceBase": "search-and-select/demo/log",
        "codeFiles": arr!["step.rs", "blocks.rs"],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::search_and_select::demo::log::blocks::__init();
        let _ = log_step();
    });
}
