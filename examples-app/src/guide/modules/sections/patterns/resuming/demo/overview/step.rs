//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/resuming/demo/overview/step.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::resuming::demo::overview::blocks::clear_button;
use crate::guide::modules::sections::patterns::resuming::demo::overview::blocks::continue_button;
use crate::guide::modules::sections::patterns::resuming::demo::overview::blocks::heading;
use crate::guide::modules::sections::patterns::resuming::demo::overview::blocks::intro;
use crate::guide::modules::sections::patterns::resuming::demo::overview::blocks::resume_panel;
use crate::guide::modules::sections::patterns::resuming::demo::overview::blocks::scenarios_heading;
use crate::guide::modules::sections::patterns::resuming::demo::overview::blocks::seed_complete_button;
use crate::guide::modules::sections::patterns::resuming::demo::overview::blocks::seed_partial_button;
use crate::guide::modules::sections::patterns::resuming::demo::overview::blocks::shows;
use crate::guide::modules::sections::patterns::resuming::demo::overview::blocks::shows_list;
use crate::guide::modules::sections::patterns::resuming::demo::overview::blocks::start_button;
use crate::guide::support::pattern_step;

pub fn overview_step() -> D {
    pattern_step(obj! {
        "path": "/overview",
        "title": "Resuming a partially-completed journey",
        "reachability": obj! {
            "entryWhen": true,
            "tieBreakers": arr![tie_breaker(obj! { "priority": 100.0 })],
        },
        "metadata": obj! { "hiddenFromNav": true },
        "blocks": arr![
            heading(),
            intro(),
            shows(),
            shows_list(),
            resume_panel(),
            continue_button(),
            start_button(),
            scenarios_heading(),
            seed_partial_button(),
            seed_complete_button(),
            clear_button(),
        ],
        "onSubmission": arr![
            submit(obj! {
                "when": post("action").matches(condition::equals("seed-partial")),
                "validate": false,
                "onAlways": obj! {
                    "effects": arr![function("FunctionType.Effect", "SeedDraftAnswers", vec![D::from("resuming"), D::V(obj! { "fullName": "Ada Lovelace" })])],
                },
            }),
            submit(obj! {
                "when": post("action").matches(condition::equals("seed-complete")),
                "validate": false,
                "onAlways": obj! {
                    "effects": arr![function("FunctionType.Effect", "SeedDraftAnswers", vec![D::from("resuming"), D::V(obj! { "fullName": "Ada Lovelace", "role": "Developer" })])],
                },
            }),
            submit(obj! {
                "when": post("action").matches(condition::equals("clear")),
                "validate": false,
                "onAlways": obj! {
                    "effects": arr![
                        function("FunctionType.Effect", "ClearAnswers", vec![D::from("resuming")]),
                        function("FunctionType.Effect", "ClearDraftAnswers", vec![D::from("resuming")]),
                    ],
                },
            }),
        ],
        "sourceBase": "resuming/demo",
        "codeFiles": arr!["journey.rs", "overview/step.rs", "overview/blocks.rs"],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::resuming::demo::overview::blocks::__init();
        let _ = overview_step();
    });
}
