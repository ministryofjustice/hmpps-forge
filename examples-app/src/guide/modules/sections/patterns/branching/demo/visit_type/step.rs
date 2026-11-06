//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/branching/demo/visit-type/step.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::branching::demo::visit_type::blocks::continue_button;
use crate::guide::modules::sections::patterns::branching::demo::visit_type::blocks::visit_type_field;
use crate::guide::support::pattern_step;

pub fn visit_type_step() -> D {
    pattern_step(obj! {
        "code": "visit-type",
        "path": "/visit-type",
        "title": "How would you like to meet?",
        "reachability": obj! { "entryWhen": true },
        "blocks": arr![visit_type_field(), continue_button()],
        "onSubmission": arr![submit(obj! {
            "validate": true,
            "onValid": obj! {
                "effects": arr![function("FunctionType.Effect", "SaveDraftAnswers", vec![D::from("branching")])],
                "next": arr![
                    redirect(obj! {
                        "when": answer("visitType").matches(condition::equals("in-person")),
                        "goto": "location",
                    }),
                    redirect(obj! {
                        "when": answer("visitType").matches(condition::equals("video")),
                        "goto": "video-email",
                    }),
                    redirect(obj! {
                        "when": answer("visitType").matches(condition::equals("phone")),
                        "goto": "phone-number",
                    }),
                ],
            },
        })],
        "sourceBase": "branching/demo/visit-type",
        "codeFiles": arr!["step.rs", "blocks.rs"],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::branching::demo::visit_type::blocks::__init();
        let _ = visit_type_step();
    });
}
