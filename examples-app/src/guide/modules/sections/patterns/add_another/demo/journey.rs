//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/add-another/demo/journey.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::add_another::demo::add_contact::step::add_contact_step;
use crate::guide::modules::sections::patterns::add_another::demo::check_answers::step::check_answers_step;
use crate::guide::modules::sections::patterns::add_another::demo::confirmation::step::confirmation_step;
use crate::guide::modules::sections::patterns::add_another::demo::delete_contact::step::delete_contact_step;
use crate::guide::modules::sections::patterns::add_another::demo::edit_contact::step::edit_contact_step;
use crate::guide::modules::sections::patterns::add_another::demo::overview::step::overview_step;
use crate::guide::modules::sections::patterns::add_another::demo::your_contacts::step::your_contacts_step;

pub fn add_another_demo_journey() -> D {
    journey(obj! {
        "code": "add-another-demo",
        "title": "Adding, editing and deleting from collections",
        "path": "/add-another",
        "onAccess": arr![access(obj! {
            "effects": arr![function("FunctionType.Effect", "LoadDraftAnswers", vec![D::from("add-another")])],
        })],
        "steps": arr![
            overview_step(),
            your_contacts_step(),
            add_contact_step(),
            edit_contact_step(),
            delete_contact_step(),
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
        crate::guide::modules::sections::patterns::add_another::demo::overview::step::__init();
        crate::guide::modules::sections::patterns::add_another::demo::your_contacts::step::__init();
        crate::guide::modules::sections::patterns::add_another::demo::add_contact::step::__init();
        crate::guide::modules::sections::patterns::add_another::demo::edit_contact::step::__init();
        crate::guide::modules::sections::patterns::add_another::demo::delete_contact::step::__init();
        crate::guide::modules::sections::patterns::add_another::demo::check_answers::step::__init();
        crate::guide::modules::sections::patterns::add_another::demo::confirmation::step::__init();
        let _ = add_another_demo_journey();
    });
}
