//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/pre-fill/demo/journey.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::pre_fill::demo::check_answers::step::check_answers_step;
use crate::guide::modules::sections::patterns::pre_fill::demo::confirmation::step::confirmation_step;
use crate::guide::modules::sections::patterns::pre_fill::demo::find_address::step::find_address_step;
use crate::guide::modules::sections::patterns::pre_fill::demo::overview::step::overview_step;

pub fn pre_fill_demo_journey() -> D {
    journey(obj! {
        "code": "pre-fill-demo",
        "title": "Pre-fill from an external system",
        "path": "/pre-fill",
        "onAccess": arr![access(obj! {
            "effects": arr![function("FunctionType.Effect", "LoadDraftAnswers", vec![D::from("pre-fill")])],
        })],
        "steps": arr![
            overview_step(),
            find_address_step(),
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
        crate::guide::modules::sections::patterns::pre_fill::demo::overview::step::__init();
        crate::guide::modules::sections::patterns::pre_fill::demo::find_address::step::__init();
        crate::guide::modules::sections::patterns::pre_fill::demo::check_answers::step::__init();
        crate::guide::modules::sections::patterns::pre_fill::demo::confirmation::step::__init();
        let _ = pre_fill_demo_journey();
    });
}
