//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/add-another/demo/your-contacts/step.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::add_another::demo::your_contacts::blocks::button_group;
use crate::guide::modules::sections::patterns::add_another::demo::your_contacts::blocks::contact_cards;
use crate::guide::modules::sections::patterns::add_another::demo::your_contacts::blocks::heading;
use crate::guide::support::pattern_step;

pub fn your_contacts_step() -> D {
    pattern_step(obj! {
        "code": "your-contacts",
        "path": "/your-contacts",
        "title": "Your emergency contacts",
        "reachability": obj! { "entryWhen": true },
        "blocks": arr![heading(), contact_cards(), button_group()],
        "validWhen": arr![validation(obj! {
            "condition": answer("contacts").matches(condition::is_required()),
            "message": "Add at least one emergency contact",
        })],
        "onSubmission": arr![
            submit(obj! {
                "when": post("action").matches(condition::equals("add-another")),
                "validate": false,
                "onAlways": obj! {
                    "effects": arr![function("FunctionType.Effect", "SaveDraftAnswers", vec![D::from("add-another")])],
                    "next": arr![redirect(obj! { "goto": "add-contact" })],
                },
            }),
            submit(obj! {
                "when": post("action").matches(condition::equals("continue")),
                "validate": true,
                "onValid": obj! { "next": arr![redirect(obj! { "goto": "check-answers" })] },
            }),
        ],
        "sourceBase": "add-another/demo/your-contacts",
        "codeFiles": arr!["step.rs", "blocks.rs"],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::add_another::demo::your_contacts::blocks::__init();
        let _ = your_contacts_step();
    });
}
