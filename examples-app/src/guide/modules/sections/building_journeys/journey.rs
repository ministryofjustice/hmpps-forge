//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/building-journeys/journey.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::building_journeys::blocks::step::defining_blocks_and_fields_step;
use crate::guide::modules::sections::building_journeys::defining_a_journey::step::defining_a_journey_step;
use crate::guide::modules::sections::building_journeys::defining_steps::step::defining_steps_step;
use crate::guide::modules::sections::building_journeys::definitions_and_runtime::step::definitions_and_runtime_step;
use crate::guide::modules::sections::building_journeys::hooks_and_lifecycle::step::hooks_and_lifecycle_step;
use crate::guide::modules::sections::building_journeys::loading_saving_and_redirecting::step::loading_saving_and_redirecting_step;
use crate::guide::modules::sections::building_journeys::navigation_tree::step::navigation_tree_step;
use crate::guide::modules::sections::building_journeys::overview::step::building_journeys_overview_step;
use crate::guide::modules::sections::building_journeys::reachability::step::reachability_step;
use crate::guide::modules::sections::building_journeys::registering_a_journey::step::registering_a_journey_step;
use crate::guide::modules::sections::building_journeys::routing_and_entry_points::step::routing_and_entry_points_step;
use crate::guide::modules::sections::building_journeys::shaping_data::step::shaping_data_step;
use crate::guide::modules::sections::building_journeys::testing::step::testing_step;
use crate::guide::modules::sections::building_journeys::validation::step::validation_step;

pub fn building_journeys_journey() -> D {
    journey(obj! {
        "code": "building-journeys",
        "title": "Building journeys",
        "path": "/building-journeys",
        "view": obj! { "locals": obj! { "showBackToTop": true } },
        "steps": arr![
            building_journeys_overview_step(),
            defining_a_journey_step(),
            defining_steps_step(),
            defining_blocks_and_fields_step(),
            registering_a_journey_step(),
            routing_and_entry_points_step(),
            reachability_step(),
            navigation_tree_step(),
            hooks_and_lifecycle_step(),
            definitions_and_runtime_step(),
            loading_saving_and_redirecting_step(),
            shaping_data_step(),
            validation_step(),
            testing_step(),
        ],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::building_journeys::overview::step::__init();
        crate::guide::modules::sections::building_journeys::defining_a_journey::step::__init();
        crate::guide::modules::sections::building_journeys::registering_a_journey::step::__init();
        crate::guide::modules::sections::building_journeys::defining_steps::step::__init();
        crate::guide::modules::sections::building_journeys::blocks::step::__init();
        crate::guide::modules::sections::building_journeys::routing_and_entry_points::step::__init();
        crate::guide::modules::sections::building_journeys::reachability::step::__init();
        crate::guide::modules::sections::building_journeys::navigation_tree::step::__init();
        crate::guide::modules::sections::building_journeys::hooks_and_lifecycle::step::__init();
        crate::guide::modules::sections::building_journeys::definitions_and_runtime::step::__init();
        crate::guide::modules::sections::building_journeys::loading_saving_and_redirecting::step::__init();
        crate::guide::modules::sections::building_journeys::shaping_data::step::__init();
        crate::guide::modules::sections::building_journeys::validation::step::__init();
        crate::guide::modules::sections::building_journeys::testing::step::__init();
        let _ = building_journeys_journey();
    });
}
