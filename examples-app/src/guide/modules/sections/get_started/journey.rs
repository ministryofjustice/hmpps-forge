//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/get-started/journey.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::get_started::creating_your_first_journey::step::creating_your_first_journey_step;
use crate::guide::modules::sections::get_started::faq::step::faq_step;
use crate::guide::modules::sections::get_started::get_in_touch::step::get_in_touch_step;
use crate::guide::modules::sections::get_started::install_frontend_libraries::step::install_frontend_libraries_step;
use crate::guide::modules::sections::get_started::installing_forge::step::installing_forge_step;
use crate::guide::modules::sections::get_started::overview::step::get_started_overview_step;
use crate::guide::modules::sections::get_started::using_forge_in_your_app::step::using_forge_in_your_app_step;
use crate::guide::modules::sections::get_started::using_forge_with_topcoat_and_runjucks::step::using_forge_with_topcoat_and_runjucks_step;
use crate::guide::modules::sections::get_started::why_use_forge::step::why_use_forge_step;

pub fn get_started_journey() -> D {
    journey(obj! {
        "code": "get-started",
        "title": "Get started",
        "path": "/get-started",
        "view": obj! { "locals": obj! { "showBackToTop": true } },
        "steps": arr![
            get_started_overview_step(),
            why_use_forge_step(),
            installing_forge_step(),
            install_frontend_libraries_step(),
            using_forge_in_your_app_step(),
            using_forge_with_topcoat_and_runjucks_step(),
            creating_your_first_journey_step(),
            faq_step(),
            get_in_touch_step(),
        ],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::get_started::overview::step::__init();
        crate::guide::modules::sections::get_started::why_use_forge::step::__init();
        crate::guide::modules::sections::get_started::installing_forge::step::__init();
        crate::guide::modules::sections::get_started::install_frontend_libraries::step::__init();
        crate::guide::modules::sections::get_started::using_forge_in_your_app::step::__init();
        crate::guide::modules::sections::get_started::using_forge_with_topcoat_and_runjucks::step::__init();
        crate::guide::modules::sections::get_started::creating_your_first_journey::step::__init();
        crate::guide::modules::sections::get_started::faq::step::__init();
        crate::guide::modules::sections::get_started::get_in_touch::step::__init();
        let _ = get_started_journey();
    });
}
