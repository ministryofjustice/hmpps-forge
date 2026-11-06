//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/collection-validation/demo/manage-plan/step.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::collection_validation::demo::manage_plan::blocks::continue_button;
use crate::guide::modules::sections::patterns::collection_validation::demo::manage_plan::blocks::goal_actions;
use crate::guide::modules::sections::patterns::collection_validation::demo::manage_plan::blocks::heading;
use crate::guide::modules::sections::patterns::collection_validation::demo::manage_plan::blocks::intro;
use crate::guide::support::pattern_step;

pub fn manage_plan_step() -> D {
    pattern_step(obj! {
        "code": "manage-plan",
        "path": "/manage-plan",
        "title": "Add actions to goals",
        "reachability": obj! { "entryWhen": true },
        "blocks": arr![heading(), intro(), goal_actions(), continue_button()],
        "onAccess": arr![access(obj! { "effects": arr![function("FunctionType.Effect", "InitializePlanActions", vec![])] })],
        "onSubmission": arr![submit(obj! {
            "validate": false,
            "onAlways": obj! {
                "effects": arr![function("FunctionType.Effect", "SavePlanActions", vec![])],
                "next": arr![redirect(obj! { "goto": "agree-plan" })],
            },
        })],
        "sourceBase": "collection-validation/demo/manage-plan",
        "codeFiles": arr!["step.rs", "blocks.rs"],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::collection_validation::demo::manage_plan::blocks::__init();
        let _ = manage_plan_step();
    });
}
