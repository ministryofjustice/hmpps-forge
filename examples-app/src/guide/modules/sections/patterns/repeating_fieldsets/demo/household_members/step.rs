//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/repeating-fieldsets/demo/household-members/step.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::repeating_fieldsets::demo::household_members::blocks::button_group;
use crate::guide::modules::sections::patterns::repeating_fieldsets::demo::household_members::blocks::heading;
use crate::guide::modules::sections::patterns::repeating_fieldsets::demo::household_members::blocks::member_rows;
use crate::guide::support::pattern_step;

fn pattern_code() -> D {
    D::from("repeating-fieldsets")
}

fn collection_code() -> D {
    D::from("members")
}

fn field_codes() -> D {
    arr!["memberName", "memberAge"]
}

pub fn household_members_step() -> D {
    pattern_step(obj! {
        "code": "household-members",
        "path": "/household-members",
        "title": "Household members",
        "reachability": obj! { "entryWhen": true },
        "blocks": arr![heading(), member_rows(), button_group()],
        "onAccess": arr![access(obj! {
            "effects": arr![function("FunctionType.Effect", "InitializeRepeatingFieldsets", vec![pattern_code(), collection_code(), field_codes()])],
        })],
        "onSubmission": arr![
            submit(obj! {
                "when": post("action").matches(condition::equals("add-another")),
                "validate": false,
                "onAlways": obj! {
                    "effects": arr![function("FunctionType.Effect", "AddRepeatingItem", vec![pattern_code(), collection_code(), field_codes()])],
                },
            }),
            submit(obj! {
                "when": post("action").matches(condition::string::starts_with("remove_")),
                "validate": false,
                "onAlways": obj! {
                    "effects": arr![function("FunctionType.Effect", "RemoveRepeatingItem", vec![pattern_code(), collection_code(), field_codes()])],
                },
            }),
            submit(obj! {
                "when": post("action").matches(condition::equals("continue")),
                "validate": true,
                "onValid": obj! {
                    "effects": arr![function("FunctionType.Effect", "SaveRepeatingItems", vec![pattern_code(), collection_code(), field_codes()])],
                    "next": arr![redirect(obj! { "goto": "check-answers" })],
                },
            }),
        ],
        "validWhen": arr![validation(obj! {
            "condition": data("members").matches(condition::is_required()),
            "message": "Add at least one household member",
        })],
        "sourceBase": "repeating-fieldsets/demo/household-members",
        "codeFiles": arr!["step.rs", "blocks.rs", obj! { "path": "/effects.rs", "effects": arr!["InitializeRepeatingFieldsets", "AddRepeatingItem", "RemoveRepeatingItem", "SaveRepeatingItems"] }],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::repeating_fieldsets::demo::household_members::blocks::__init();
        let _ = pattern_code();
        let _ = collection_code();
        let _ = field_codes();
        let _ = household_members_step();
    });
}
