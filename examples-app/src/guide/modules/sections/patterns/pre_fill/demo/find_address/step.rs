//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/pre-fill/demo/find-address/step.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::pre_fill::demo::find_address::blocks::address_county_field;
use crate::guide::modules::sections::patterns::pre_fill::demo::find_address::blocks::address_line1_field;
use crate::guide::modules::sections::patterns::pre_fill::demo::find_address::blocks::address_line2_field;
use crate::guide::modules::sections::patterns::pre_fill::demo::find_address::blocks::address_postcode_field;
use crate::guide::modules::sections::patterns::pre_fill::demo::find_address::blocks::address_town_field;
use crate::guide::modules::sections::patterns::pre_fill::demo::find_address::blocks::button_group;
use crate::guide::modules::sections::patterns::pre_fill::demo::find_address::blocks::find_address_button;
use crate::guide::modules::sections::patterns::pre_fill::demo::find_address::blocks::heading;
use crate::guide::modules::sections::patterns::pre_fill::demo::find_address::blocks::postcode_field;
use crate::guide::support::pattern_step;

pub fn find_address_step() -> D {
    pattern_step(obj! {
        "code": "find-address",
        "path": "/find-address",
        "title": "Find an address",
        "reachability": obj! { "entryWhen": true },
        "blocks": arr![
            heading(),
            postcode_field(),
            find_address_button(),
            address_line1_field(),
            address_line2_field(),
            address_town_field(),
            address_county_field(),
            address_postcode_field(),
            button_group(),
        ],
        "onSubmission": arr![
            submit(obj! {
                "when": post("action").matches(condition::equals("find-address")),
                "validate": obj! { "groups": arr!["find-postcode"] },
                "onValid": obj! {
                    "effects": arr![function("FunctionType.Effect", "LookupAddress", vec![])],
                },
            }),
            submit(obj! {
                "when": post("action").matches(condition::equals("continue")),
                "validate": obj! { "groups": arr!["address"] },
                "onValid": obj! {
                    "effects": arr![function("FunctionType.Effect", "SaveDraftAnswers", vec![D::from("pre-fill")])],
                    "next": arr![redirect(obj! { "goto": "check-answers" })],
                },
            }),
        ],
        "sourceBase": "pre-fill/demo/find-address",
        "codeFiles": arr!["step.rs", "blocks.rs", obj! { "path": "/effects.rs", "effects": arr!["LookupAddress"] }],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::pre_fill::demo::find_address::blocks::__init();
        let _ = find_address_step();
    });
}
