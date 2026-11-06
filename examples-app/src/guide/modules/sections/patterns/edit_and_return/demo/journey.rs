//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/edit-and-return/demo/journey.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::edit_and_return::demo::check_answers::step::check_answers_step;
use crate::guide::modules::sections::patterns::edit_and_return::demo::confirmation::step::confirmation_step;
use crate::guide::modules::sections::patterns::edit_and_return::demo::contact_preference::step::contact_preference_step;
use crate::guide::modules::sections::patterns::edit_and_return::demo::email_address::step::email_address_step;
use crate::guide::modules::sections::patterns::edit_and_return::demo::full_name::step::full_name_step;
use crate::guide::modules::sections::patterns::edit_and_return::demo::overview::step::overview_step;

pub fn edit_and_return_demo_journey() -> D {
    journey(obj! {
        "code": "edit-and-return-demo",
        "title": "Edit and return",
        "path": "/edit-and-return",
        "onAccess": arr![access(obj! {
            "effects": arr![function("FunctionType.Effect", "LoadDraftAnswers", vec![D::from("edit-and-return")])],
        })],
        "steps": arr![
            overview_step(),
            full_name_step(),
            email_address_step(),
            contact_preference_step(),
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
        crate::guide::modules::sections::patterns::edit_and_return::demo::overview::step::__init();
        crate::guide::modules::sections::patterns::edit_and_return::demo::full_name::step::__init();
        crate::guide::modules::sections::patterns::edit_and_return::demo::email_address::step::__init();
        crate::guide::modules::sections::patterns::edit_and_return::demo::contact_preference::step::__init();
        crate::guide::modules::sections::patterns::edit_and_return::demo::check_answers::step::__init();
        crate::guide::modules::sections::patterns::edit_and_return::demo::confirmation::step::__init();
        let _ = edit_and_return_demo_journey();
    });
}
