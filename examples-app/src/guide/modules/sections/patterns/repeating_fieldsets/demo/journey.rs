//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/repeating-fieldsets/demo/journey.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::repeating_fieldsets::demo::check_answers::step::check_answers_step;
use crate::guide::modules::sections::patterns::repeating_fieldsets::demo::confirmation::step::confirmation_step;
use crate::guide::modules::sections::patterns::repeating_fieldsets::demo::household_members::step::household_members_step;
use crate::guide::modules::sections::patterns::repeating_fieldsets::demo::overview::step::overview_step;

pub fn repeating_fieldsets_demo_journey() -> D {
    journey(obj! {
        "code": "repeating-fieldsets-demo",
        "title": "Repeating fieldsets",
        "path": "/repeating-fieldsets",
        "steps": arr![
            overview_step(),
            household_members_step(),
            check_answers_step(),
            confirmation_step(),
        ],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::repeating_fieldsets::demo::overview::step::__init();
        crate::guide::modules::sections::patterns::repeating_fieldsets::demo::household_members::step::__init();
        crate::guide::modules::sections::patterns::repeating_fieldsets::demo::check_answers::step::__init();
        crate::guide::modules::sections::patterns::repeating_fieldsets::demo::confirmation::step::__init();
        let _ = repeating_fieldsets_demo_journey();
    });
}
