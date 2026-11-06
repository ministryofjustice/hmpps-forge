//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/resuming/demo/journey.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::resuming::demo::check_answers::step::check_answers_step;
use crate::guide::modules::sections::patterns::resuming::demo::confirmation::step::confirmation_step;
use crate::guide::modules::sections::patterns::resuming::demo::overview::step::overview_step;
use crate::guide::modules::sections::patterns::resuming::demo::your_name::step::your_name_step;
use crate::guide::modules::sections::patterns::resuming::demo::your_role::step::your_role_step;

pub fn resuming_demo_journey() -> D {
    journey(obj! {
        "code": "resuming-demo",
        "title": "Resuming a partially-completed journey",
        "path": "/resuming",
        "reachability": obj! { "resumeWhen": query("resume").matches(condition::equals("true")) },
        "onAccess": arr![access(obj! {
            "effects": arr![function("FunctionType.Effect", "LoadDraftAnswers", vec![D::from("resuming")])],
        })],
        "steps": arr![
            overview_step(),
            your_name_step(),
            your_role_step(),
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
        crate::guide::modules::sections::patterns::resuming::demo::overview::step::__init();
        crate::guide::modules::sections::patterns::resuming::demo::your_name::step::__init();
        crate::guide::modules::sections::patterns::resuming::demo::your_role::step::__init();
        crate::guide::modules::sections::patterns::resuming::demo::check_answers::step::__init();
        crate::guide::modules::sections::patterns::resuming::demo::confirmation::step::__init();
        let _ = resuming_demo_journey();
    });
}
