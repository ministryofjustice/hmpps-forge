//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/functions-and-effects/journey.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


pub fn functions_and_effects_journey() -> D {
    journey(obj! {
        "code": "functions-and-effects",
        "title": "Functions and effects",
        "path": "/functions-and-effects",
        "view": obj! { "locals": obj! { "showBackToTop": true } },
        "steps": arr![],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = functions_and_effects_journey();
    });
}
