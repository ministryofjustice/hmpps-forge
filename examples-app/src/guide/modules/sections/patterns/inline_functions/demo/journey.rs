//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/inline-functions/demo/journey.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::inline_functions::demo::after::step::after_step;
use crate::guide::modules::sections::patterns::inline_functions::demo::before::step::before_step;
use crate::guide::modules::sections::patterns::inline_functions::demo::overview::step::overview_step;

pub fn inline_functions_demo_journey() -> D {
    journey(obj! {
        "code": "inline-functions-demo",
        "title": "Shaping data inline",
        "path": "/inline-functions",
        "steps": arr![overview_step(), before_step(), after_step()],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::inline_functions::demo::overview::step::__init();
        crate::guide::modules::sections::patterns::inline_functions::demo::before::step::__init();
        crate::guide::modules::sections::patterns::inline_functions::demo::after::step::__init();
        let _ = inline_functions_demo_journey();
    });
}
