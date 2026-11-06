//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/collection-validation/demo/journey.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::collection_validation::demo::agree_plan::step::agree_plan_step;
use crate::guide::modules::sections::patterns::collection_validation::demo::confirmation::step::confirmation_step;
use crate::guide::modules::sections::patterns::collection_validation::demo::manage_plan::step::manage_plan_step;
use crate::guide::modules::sections::patterns::collection_validation::demo::overview::step::overview_step;

pub fn collection_validation_demo_journey() -> D {
    journey(obj! {
        "code": "collection-validation-demo",
        "title": "Validating collections with iterators",
        "path": "/collection-validation",
        "onAccess": arr![access(obj! { "effects": arr![function("FunctionType.Effect", "LoadPlanGoals", vec![])] })],
        "steps": arr![overview_step(), manage_plan_step(), agree_plan_step(), confirmation_step()],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::collection_validation::demo::overview::step::__init();
        crate::guide::modules::sections::patterns::collection_validation::demo::agree_plan::step::__init();
        crate::guide::modules::sections::patterns::collection_validation::demo::manage_plan::step::__init();
        crate::guide::modules::sections::patterns::collection_validation::demo::confirmation::step::__init();
        let _ = collection_validation_demo_journey();
    });
}
