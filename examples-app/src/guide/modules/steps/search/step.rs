//! Ported from `examples-app/server/journeys/forge-developer-guide/steps/search/step.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::steps::search::blocks::heading;
use crate::guide::modules::steps::search::blocks::search_form;
use crate::guide::modules::steps::search::blocks::search_results;

pub fn search_step() -> D {
    step(obj! {
        "path": "/search",
        "title": "Search",
        "reachability": obj! { "entryWhen": true },
        "metadata": obj! { "hiddenFromNav": true },
        "view": obj! { "locals": obj! { "showBackToTop": true } },
        "onAccess": arr![access(obj! { "effects": arr![function("FunctionType.Effect", "SearchContent", vec![])] })],
        "blocks": arr![heading(), search_form(), search_results()],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::steps::search::blocks::__init();
        let _ = search_step();
    });
}
