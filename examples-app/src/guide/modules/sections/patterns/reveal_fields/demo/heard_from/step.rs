//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/reveal-fields/demo/heard-from/step.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::reveal_fields::demo::heard_from::blocks::continue_button;
use crate::guide::modules::sections::patterns::reveal_fields::demo::heard_from::blocks::heard_from_field;
use crate::guide::support::pattern_step;

pub fn heard_from_step() -> D {
    pattern_step(obj! {
        "code": "heard-from",
        "path": "/heard-from",
        "title": "How did you hear about us?",
        "reachability": obj! { "entryWhen": true },
        "blocks": arr![heard_from_field(), continue_button()],
        "onSubmission": arr![submit(obj! {
            "validate": true,
            "onValid": obj! {
                "effects": arr![function("FunctionType.Effect", "SaveDraftAnswers", vec![D::from("reveal-fields")])],
                "next": arr![redirect(obj! { "goto": "check-answers" })],
            },
        })],
        "sourceBase": "reveal-fields/demo/heard-from",
        "codeFiles": arr!["step.rs", "blocks.rs"],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::reveal_fields::demo::heard_from::blocks::__init();
        let _ = heard_from_step();
    });
}
