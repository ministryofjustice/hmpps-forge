//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/search-and-select/step.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::blocks::blocks::content;
use crate::guide::support::load_content;

pub fn search_and_select_pattern_step() -> D {
    step(obj! {
        "path": "/search-and-select",
        "title": "Search and select",
        "reachability": obj! { "entryWhen": true },
        "metadata": obj! { "navGroup": "Searching and results" },
        "onAccess": arr![load_content(D::from("patterns-search-and-select"))],
        "blocks": arr![content()],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::blocks::blocks::__init();
        let _ = search_and_select_pattern_step();
    });
}
