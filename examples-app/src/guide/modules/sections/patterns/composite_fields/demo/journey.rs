//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/composite-fields/demo/journey.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::composite_fields::demo::address::step::address_step;
use crate::guide::modules::sections::patterns::composite_fields::demo::check_answers::step::check_answers_step;
use crate::guide::modules::sections::patterns::composite_fields::demo::confirmation::step::confirmation_step;
use crate::guide::modules::sections::patterns::composite_fields::demo::date_of_birth::step::date_of_birth_step;
use crate::guide::modules::sections::patterns::composite_fields::demo::overview::step::overview_step;

pub fn composite_fields_demo_journey() -> D {
    journey(obj! {
        "code": "composite-fields-demo",
        "title": "Multi-part composite fields",
        "path": "/composite-fields",
        "onAccess": arr![access(obj! {
            "effects": arr![function("FunctionType.Effect", "LoadDraftAnswers", vec![D::from("composite-fields")])],
        })],
        "steps": arr![
            overview_step(),
            date_of_birth_step(),
            address_step(),
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
        crate::guide::modules::sections::patterns::composite_fields::demo::overview::step::__init();
        crate::guide::modules::sections::patterns::composite_fields::demo::date_of_birth::step::__init();
        crate::guide::modules::sections::patterns::composite_fields::demo::address::step::__init();
        crate::guide::modules::sections::patterns::composite_fields::demo::check_answers::step::__init();
        crate::guide::modules::sections::patterns::composite_fields::demo::confirmation::step::__init();
        let _ = composite_fields_demo_journey();
    });
}
