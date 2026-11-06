//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/pagination/demo/list/step.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::pagination::demo::list::blocks::heading;
use crate::guide::modules::sections::patterns::pagination::demo::list::blocks::page_info;
use crate::guide::modules::sections::patterns::pagination::demo::list::blocks::pagination;
use crate::guide::modules::sections::patterns::pagination::demo::list::blocks::station_list;
use crate::guide::support::pattern_step;

pub fn list_step() -> D {
    pattern_step(obj! {
        "code": "list",
        "path": "/list",
        "title": "Stations",
        "reachability": obj! { "entryWhen": true },
        "onAccess": arr![access(obj! { "effects": arr![function("FunctionType.Effect", "LoadStationPage", vec![])] })],
        "blocks": arr![heading(), page_info(), station_list(), pagination()],
        "sourceBase": "pagination/demo/list",
        "codeFiles": arr!["step.rs", "blocks.rs"],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::pagination::demo::list::blocks::__init();
        let _ = list_step();
    });
}
