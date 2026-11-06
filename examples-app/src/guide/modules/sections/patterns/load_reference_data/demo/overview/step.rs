//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/load-reference-data/demo/overview/step.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::load_reference_data::demo::overview::blocks::heading;
use crate::guide::modules::sections::patterns::load_reference_data::demo::overview::blocks::intro;
use crate::guide::modules::sections::patterns::load_reference_data::demo::overview::blocks::shows;
use crate::guide::modules::sections::patterns::load_reference_data::demo::overview::blocks::shows_list;
use crate::guide::modules::sections::patterns::load_reference_data::demo::overview::blocks::start_button;
use crate::guide::support::pattern_step;

pub fn overview_step() -> D {
    pattern_step(obj! {
        "path": "/overview",
        "title": "Load reference data on access",
        "reachability": obj! { "entryWhen": true },
        "metadata": obj! { "hiddenFromNav": true },
        "blocks": arr![heading(), intro(), shows(), shows_list(), start_button()],
        "sourceBase": "load-reference-data/demo",
        "codeFiles": arr![
            "journey.rs",
            obj! { "path": "/effects.rs", "effects": arr!["DrawLotteryNumbers"] },
            "overview/blocks.rs",
        ],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::load_reference_data::demo::overview::blocks::__init();
        let _ = overview_step();
    });
}
