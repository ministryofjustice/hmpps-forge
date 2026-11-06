//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/building-journeys/loading-saving-and-redirecting/step.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::building_journeys::blocks::blocks::content;
use crate::guide::support::load_content;

pub fn loading_saving_and_redirecting_step() -> D {
    step(obj! {
        "path": "/loading-saving-and-redirecting",
        "title": "Loading, saving and redirecting",
        "reachability": obj! { "entryWhen": true },
        "metadata": obj! { "navGroup": "Working with data" },
        "onAccess": arr![load_content(D::from("loading-saving-and-redirecting"))],
        "blocks": arr![content()],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::building_journeys::blocks::blocks::__init();
        let _ = loading_saving_and_redirecting_step();
    });
}
