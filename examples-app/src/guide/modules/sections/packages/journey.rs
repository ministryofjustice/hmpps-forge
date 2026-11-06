//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/packages/journey.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::packages::topcoat::journey::topcoat_journey;
use crate::guide::modules::sections::packages::forge_core::journey::forge_core_journey;
use crate::guide::modules::sections::packages::govuk_components::journey::govuk_components_journey;
use crate::guide::modules::sections::packages::moj_components::journey::moj_components_journey;
use crate::guide::modules::sections::packages::overview::step::packages_overview_step;

pub fn packages_journey() -> D {
    journey(obj! {
        "code": "packages",
        "title": "Packages",
        "path": "/packages",
        "view": obj! { "locals": obj! { "showBackToTop": true } },
        "steps": arr![packages_overview_step()],
        "children": arr![
            forge_core_journey(),
            topcoat_journey(),
            govuk_components_journey(),
            moj_components_journey(),
        ],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::packages::overview::step::__init();
        crate::guide::modules::sections::packages::forge_core::journey::__init();
        crate::guide::modules::sections::packages::topcoat::journey::__init();
        crate::guide::modules::sections::packages::govuk_components::journey::__init();
        crate::guide::modules::sections::packages::moj_components::journey::__init();
        let _ = packages_journey();
    });
}
