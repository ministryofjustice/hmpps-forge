//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/edit-and-return/demo/email-address/step.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::edit_and_return::demo::email_address::blocks::continue_button;
use crate::guide::modules::sections::patterns::edit_and_return::demo::email_address::blocks::email_field;
use crate::guide::support::pattern_step;

pub fn email_address_step() -> D {
    pattern_step(obj! {
        "code": "email-address",
        "path": "/email-address",
        "title": "What is your email address?",
        "reachability": obj! { "entryWhen": true },
        "blocks": arr![email_field(), continue_button()],
        "onSubmission": arr![submit(obj! {
            "validate": true,
            "onValid": obj! {
                "effects": arr![function("FunctionType.Effect", "SaveDraftAnswers", vec![D::from("edit-and-return")])],
                "next": arr![
                    redirect(obj! {
                        "when": query("returnTo").matches(condition::equals("check-answers")),
                        "goto": "check-answers",
                    }),
                    redirect(obj! { "goto": "contact-preference" }),
                ],
            },
        })],
        "sourceBase": "edit-and-return/demo/email-address",
        "codeFiles": arr!["step.rs", "blocks.rs"],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::edit_and_return::demo::email_address::blocks::__init();
        let _ = email_address_step();
    });
}
