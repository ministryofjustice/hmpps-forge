//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/packages/topcoat/journey.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::packages::topcoat::building_components::step::topcoat_building_components_step;
use crate::guide::modules::sections::packages::topcoat::nunjucks_generators::step::topcoat_generators_step;
use crate::guide::modules::sections::packages::topcoat::overview::step::topcoat_overview_step;
use crate::guide::modules::sections::packages::topcoat::rendering::step::topcoat_rendering_step;
use crate::guide::modules::sections::packages::topcoat::request_state::step::topcoat_request_state_step;

pub fn topcoat_journey() -> D {
    journey(obj! {
        "code": "topcoat",
        "title": "Topcoat Adapter",
        "path": "/topcoat",
        "metadata": obj! { "navGroup": "Frameworks" },
        "view": obj! { "locals": obj! { "showBackToTop": true } },
        "steps": arr![
            topcoat_overview_step(),
            topcoat_request_state_step(),
            topcoat_rendering_step(),
            topcoat_building_components_step(),
            topcoat_generators_step(),
        ],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::packages::topcoat::overview::step::__init();
        crate::guide::modules::sections::packages::topcoat::request_state::step::__init();
        crate::guide::modules::sections::packages::topcoat::rendering::step::__init();
        crate::guide::modules::sections::packages::topcoat::building_components::step::__init();
        crate::guide::modules::sections::packages::topcoat::nunjucks_generators::step::__init();
        let _ = topcoat_journey();
    });
}
