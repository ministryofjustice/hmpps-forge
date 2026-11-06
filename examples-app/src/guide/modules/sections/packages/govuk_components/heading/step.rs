//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/packages/govuk-components/heading/step.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::packages::govuk_components::heading::blocks::content;

pub fn heading_step() -> D {
    step(obj! {
        "path": "/heading",
        "title": "Heading",
        "reachability": obj! { "entryWhen": true },
        "metadata": obj! { "navGroup": "Wrappers" },
        "onAccess": arr![access(obj! {
            "effects": arr![function("FunctionType.Effect", "LoadContent", vec![D::from("govuk-heading")])],
        })],
        "blocks": arr![content()],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::packages::govuk_components::heading::blocks::__init();
        let _ = heading_step();
    });
}
