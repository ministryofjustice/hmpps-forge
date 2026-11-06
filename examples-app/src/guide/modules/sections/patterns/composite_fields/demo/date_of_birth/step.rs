//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/composite-fields/demo/date-of-birth/step.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::composite_fields::demo::date_of_birth::blocks::continue_button;
use crate::guide::modules::sections::patterns::composite_fields::demo::date_of_birth::blocks::date_of_birth_field;
use crate::guide::support::pattern_step;

pub fn date_of_birth_step() -> D {
    pattern_step(obj! {
        "code": "date-of-birth",
        "path": "/date-of-birth",
        "title": "What is your date of birth?",
        "reachability": obj! {
            "entryWhen": true,
            "tieBreakers": arr![tie_breaker(obj! { "priority": 100.0 })],
        },
        "blocks": arr![date_of_birth_field(), continue_button()],
        "onSubmission": arr![submit(obj! {
            "validate": true,
            "onValid": obj! {
                "effects": arr![function("FunctionType.Effect", "SaveDraftAnswers", vec![D::from("composite-fields")])],
                "next": arr![redirect(obj! { "goto": "address" })],
            },
        })],
        "sourceBase": "composite-fields/demo/date-of-birth",
        "codeFiles": arr!["step.rs", "blocks.rs"],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::composite_fields::demo::date_of_birth::blocks::__init();
        let _ = date_of_birth_step();
    });
}
