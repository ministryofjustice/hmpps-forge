//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/add-another/demo/edit-contact/step.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::add_another::demo::edit_contact::blocks::continue_button;
use crate::guide::modules::sections::patterns::add_another::demo::edit_contact::blocks::heading;
use crate::guide::modules::sections::patterns::add_another::demo::edit_contact::blocks::name_field;
use crate::guide::modules::sections::patterns::add_another::demo::edit_contact::blocks::phone_field;
use crate::guide::modules::sections::patterns::add_another::demo::edit_contact::blocks::relationship_field;
use crate::guide::support::pattern_step;

fn contact_field_codes() -> D {
    arr!["contactName", "contactRelationship", "contactPhone"]
}

pub fn edit_contact_step() -> D {
    pattern_step(obj! {
        "code": "edit-contact",
        "path": "/edit-contact/:index",
        "title": "Change emergency contact",
        "reachability": obj! { "entryWhen": true },
        "blocks": arr![
            heading(),
            name_field(),
            relationship_field(),
            phone_field(),
            continue_button(),
        ],
        "onAccess": arr![access(obj! {
            "effects": arr![function("FunctionType.Effect", "LoadItemForEdit", vec![D::from("add-another"), D::from("contacts"), contact_field_codes()])],
        })],
        "onSubmission": arr![submit(obj! {
            "validate": true,
            "onValid": obj! {
                "effects": arr![
                    function("FunctionType.Effect", "EditItemInCollection", vec![D::from("add-another"), D::from("contacts"), contact_field_codes()]),
                    function("FunctionType.Effect", "SaveDraftAnswers", vec![D::from("add-another")]),
                ],
                "next": arr![redirect(obj! { "goto": "your-contacts" })],
            },
        })],
        "sourceBase": "add-another/demo/edit-contact",
        "codeFiles": arr!["step.rs", "blocks.rs"],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::add_another::demo::edit_contact::blocks::__init();
        let _ = contact_field_codes();
        let _ = edit_contact_step();
    });
}
