//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/read-only-mode/demo/journey.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::read_only_mode::demo::contacts::step::contacts_step;
use crate::guide::modules::sections::patterns::read_only_mode::demo::login::step::login_step;
use crate::guide::modules::sections::patterns::read_only_mode::demo::overview::step::overview_step;
use crate::guide::modules::sections::patterns::read_only_mode::demo::record::step::record_step;

pub fn read_only_mode_demo_journey() -> D {
    journey(obj! {
        "code": "read-only-mode-demo",
        "title": "Read-only mode",
        "path": "/read-only-mode",
        "onAccess": arr![access(obj! {
            "effects": arr![function("FunctionType.Effect", "LoadDraftAnswers", vec![D::from("read-only-mode")])],
        })],
        "steps": arr![overview_step(), login_step(), contacts_step(), record_step()],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::read_only_mode::demo::overview::step::__init();
        crate::guide::modules::sections::patterns::read_only_mode::demo::login::step::__init();
        crate::guide::modules::sections::patterns::read_only_mode::demo::contacts::step::__init();
        crate::guide::modules::sections::patterns::read_only_mode::demo::record::step::__init();
        let _ = read_only_mode_demo_journey();
    });
}
