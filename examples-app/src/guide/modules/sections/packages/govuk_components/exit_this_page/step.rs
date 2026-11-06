//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/packages/govuk-components/exit-this-page/step.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::packages::govuk_components::exit_this_page::blocks::content;

pub fn exit_this_page_step() -> D {
    step(obj! {
        "path": "/exit-this-page",
        "title": "Exit This Page",
        "reachability": obj! { "entryWhen": true },
        "metadata": obj! { "navGroup": "Components" },
        "onAccess": arr![access(obj! {
            "effects": arr![function("FunctionType.Effect", "LoadContent", vec![D::from("govuk-exit-this-page")])],
        })],
        "blocks": arr![content()],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::packages::govuk_components::exit_this_page::blocks::__init();
        let _ = exit_this_page_step();
    });
}
