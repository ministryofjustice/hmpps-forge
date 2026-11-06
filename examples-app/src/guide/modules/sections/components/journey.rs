//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/components/journey.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::components::building_custom_components::step::building_custom_components_step;
use crate::guide::modules::sections::components::building_custom_conditions::step::building_custom_conditions_step;
use crate::guide::modules::sections::components::building_custom_effects::step::building_custom_effects_step;
use crate::guide::modules::sections::components::building_custom_generators::step::building_custom_generators_step;
use crate::guide::modules::sections::components::building_custom_transformers::step::building_custom_transformers_step;
use crate::guide::modules::sections::components::inline_functions::step::inline_functions_step;

pub fn components_journey() -> D {
    journey(obj! {
        "code": "building-functions-and-components",
        "title": "Building functions & components",
        "path": "/building-functions-and-components",
        "view": obj! { "locals": obj! { "showBackToTop": true } },
        "steps": arr![
            building_custom_transformers_step(),
            building_custom_generators_step(),
            building_custom_conditions_step(),
            building_custom_effects_step(),
            inline_functions_step(),
            building_custom_components_step(),
        ],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::components::building_custom_transformers::step::__init();
        crate::guide::modules::sections::components::building_custom_generators::step::__init();
        crate::guide::modules::sections::components::building_custom_conditions::step::__init();
        crate::guide::modules::sections::components::building_custom_effects::step::__init();
        crate::guide::modules::sections::components::inline_functions::step::__init();
        crate::guide::modules::sections::components::building_custom_components::step::__init();
        let _ = components_journey();
    });
}
