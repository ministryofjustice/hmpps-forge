//! Ported from `examples-app/server/journeys/forge-developer-guide/journey.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::building_journeys::journey::building_journeys_journey;
use crate::guide::modules::sections::components::journey::components_journey;
use crate::guide::modules::sections::expressions::journey::expressions_journey;
use crate::guide::modules::sections::get_started::journey::get_started_journey;
use crate::guide::modules::sections::packages::journey::packages_journey;
use crate::guide::modules::sections::patterns::journey::patterns_guide_journey;
use crate::guide::modules::steps::search::step::search_step;

pub fn developer_guide_journey() -> D {
    journey(obj! {
        "code": "forge-developer-guide",
        "title": "Forge Developer Guide",
        "path": "/forge-developer-guide",
        "view": obj! { "template": "partials/guide-step" },
        "reachability": obj! { "disableReachabilityChecks": true },
        "onAccess": arr![access(obj! {
            "when": request::path().matches(condition::equals("/forge-developer-guide")),
            "next": arr![redirect(obj! { "goto": "get-started/overview" })],
        })],
        "children": arr![
            get_started_journey(),
            building_journeys_journey(),
            expressions_journey(),
            components_journey(),
            patterns_guide_journey(),
            packages_journey(),
        ],
        "steps": arr![search_step()],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::steps::search::step::__init();
        crate::guide::modules::sections::get_started::journey::__init();
        crate::guide::modules::sections::building_journeys::journey::__init();
        crate::guide::modules::sections::expressions::journey::__init();
        crate::guide::modules::sections::components::journey::__init();
        crate::guide::modules::sections::packages::journey::__init();
        crate::guide::modules::sections::patterns::journey::__init();
        let _ = developer_guide_journey();
    });
}
