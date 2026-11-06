//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/branching/demo/journey.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::branching::demo::check_answers::step::check_answers_step;
use crate::guide::modules::sections::patterns::branching::demo::confirmation::step::confirmation_step;
use crate::guide::modules::sections::patterns::branching::demo::location::step::location_step;
use crate::guide::modules::sections::patterns::branching::demo::overview::step::overview_step;
use crate::guide::modules::sections::patterns::branching::demo::phone_number::step::phone_number_step;
use crate::guide::modules::sections::patterns::branching::demo::video_email::step::video_email_step;
use crate::guide::modules::sections::patterns::branching::demo::visit_type::step::visit_type_step;

pub fn branching_demo_journey() -> D {
    journey(obj! {
        "code": "branching-demo",
        "title": "Branching based on an earlier answer",
        "path": "/branching",
        "onAccess": arr![access(obj! {
            "effects": arr![function("FunctionType.Effect", "LoadDraftAnswers", vec![D::from("branching")])],
        })],
        "steps": arr![
            overview_step(),
            visit_type_step(),
            location_step(),
            video_email_step(),
            phone_number_step(),
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
        crate::guide::modules::sections::patterns::branching::demo::overview::step::__init();
        crate::guide::modules::sections::patterns::branching::demo::visit_type::step::__init();
        crate::guide::modules::sections::patterns::branching::demo::location::step::__init();
        crate::guide::modules::sections::patterns::branching::demo::video_email::step::__init();
        crate::guide::modules::sections::patterns::branching::demo::phone_number::step::__init();
        crate::guide::modules::sections::patterns::branching::demo::check_answers::step::__init();
        crate::guide::modules::sections::patterns::branching::demo::confirmation::step::__init();
        let _ = branching_demo_journey();
    });
}
