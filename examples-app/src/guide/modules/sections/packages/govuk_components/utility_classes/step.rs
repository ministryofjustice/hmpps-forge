//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/packages/govuk-components/utility-classes/step.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::packages::govuk_components::utility_classes::blocks::content;

pub fn utility_classes_step() -> D {
    step(obj! {
        "path": "/utility-classes",
        "title": "Classes",
        "reachability": obj! { "entryWhen": true },
        "metadata": obj! { "navGroup": "Utilities" },
        "onAccess": arr![access(obj! {
            "effects": arr![function("FunctionType.Effect", "LoadContent", vec![D::from("govuk-utility-classes")])],
        })],
        "blocks": arr![content()],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::packages::govuk_components::utility_classes::blocks::__init();
        let _ = utility_classes_step();
    });
}
