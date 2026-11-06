//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/packages/govuk-components/radio-input/step.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::packages::govuk_components::radio_input::blocks::content;
use crate::guide::modules::sections::packages::govuk_components::radio_input::blocks::example_groups;

#[allow(unused_variables)]
fn example_submit(group: D) -> D {
    submit(obj! {
        "when": post("action").matches(condition::equals(group.clone())),
        "validate": obj! { "groups": arr![group.clone()] },
    })
}

pub fn radio_input_step() -> D {
    step(obj! {
        "path": "/radio-input",
        "title": "Radios",
        "reachability": obj! { "entryWhen": true },
        "metadata": obj! { "navGroup": "Components" },
        "onAccess": arr![access(obj! {
            "effects": arr![function("FunctionType.Effect", "LoadContent", vec![D::from("govuk-radio-input")])],
        })],
        "blocks": arr![content()],
        "onSubmission": arr![
            example_submit(example_groups().get("basic")),
            example_submit(example_groups().get("inline")),
            example_submit(example_groups().get("divider")),
            example_submit(example_groups().get("reveal")),
            example_submit(example_groups().get("singleQuestion")),
        ],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::packages::govuk_components::radio_input::blocks::__init();
        let _ = radio_input_step();
    });
}
