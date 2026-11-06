//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/inline-functions/demo/before/step.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::inline_functions::demo::before::blocks::compliance_heading;
use crate::guide::modules::sections::patterns::inline_functions::demo::before::blocks::compliance_summary;
use crate::guide::modules::sections::patterns::inline_functions::demo::before::blocks::goals_heading;
use crate::guide::modules::sections::patterns::inline_functions::demo::before::blocks::goals_summary;
use crate::guide::modules::sections::patterns::inline_functions::demo::before::blocks::heading;
use crate::guide::modules::sections::patterns::inline_functions::demo::before::blocks::next_button;
use crate::guide::modules::sections::patterns::inline_functions::demo::before::blocks::risk_heading;
use crate::guide::modules::sections::patterns::inline_functions::demo::before::blocks::risk_scores;
use crate::guide::modules::sections::patterns::inline_functions::demo::before::blocks::sentence_details;
use crate::guide::modules::sections::patterns::inline_functions::demo::before::blocks::sentence_heading;
use crate::guide::support::pattern_step;

pub fn before_step() -> D {
    pattern_step(obj! {
        "path": "/before",
        "title": "Before: inline expressions",
        "reachability": obj! { "entryWhen": true },
        "onAccess": arr![access(obj! { "effects": arr![function("FunctionType.Effect", "LoadCaseOverview", vec![])] })],
        "blocks": arr![
            heading(),
            risk_heading(),
            risk_scores(),
            sentence_heading(),
            sentence_details(),
            goals_heading(),
            goals_summary(),
            compliance_heading(),
            compliance_summary(),
            next_button(),
        ],
        "sourceBase": "inline-functions/demo",
        "codeFiles": arr!["before/blocks.rs"],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::inline_functions::demo::before::blocks::__init();
        let _ = before_step();
    });
}
