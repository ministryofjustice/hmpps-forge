//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/single-question-per-page/demo/journey.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::single_question_per_page::demo::check_answers::step::check_answers_step;
use crate::guide::modules::sections::patterns::single_question_per_page::demo::confirmation::step::confirmation_step;
use crate::guide::modules::sections::patterns::single_question_per_page::demo::overview::step::overview_step;
use crate::guide::modules::sections::patterns::single_question_per_page::demo::your_name::step::your_name_step;
use crate::guide::modules::sections::patterns::single_question_per_page::demo::your_role::step::your_role_step;

pub fn single_question_per_page_demo_journey() -> D {
    journey(obj! {
        "code": "single-question-per-page-demo",
        "title": "Single question per page",
        "path": "/single-question-per-page",
        "onAccess": arr![access(obj! {
            "effects": arr![function("FunctionType.Effect", "LoadDraftAnswers", vec![D::from("single-question-per-page")])],
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
        crate::guide::modules::sections::patterns::single_question_per_page::demo::overview::step::__init();
        crate::guide::modules::sections::patterns::single_question_per_page::demo::your_name::step::__init();
        crate::guide::modules::sections::patterns::single_question_per_page::demo::your_role::step::__init();
        crate::guide::modules::sections::patterns::single_question_per_page::demo::check_answers::step::__init();
        crate::guide::modules::sections::patterns::single_question_per_page::demo::confirmation::step::__init();
        let _ = single_question_per_page_demo_journey();
    });
}
