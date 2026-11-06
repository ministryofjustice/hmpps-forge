//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/read-only-mode/demo/record/step.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::read_only_mode::demo::guards::require_auth;
use crate::guide::modules::sections::patterns::read_only_mode::demo::record::blocks::back_button;
use crate::guide::modules::sections::patterns::read_only_mode::demo::record::blocks::department_field;
use crate::guide::modules::sections::patterns::read_only_mode::demo::record::blocks::edit_heading;
use crate::guide::modules::sections::patterns::read_only_mode::demo::record::blocks::email_field;
use crate::guide::modules::sections::patterns::read_only_mode::demo::record::blocks::heading;
use crate::guide::modules::sections::patterns::read_only_mode::demo::record::blocks::name_field;
use crate::guide::modules::sections::patterns::read_only_mode::demo::record::blocks::role_message;
use crate::guide::modules::sections::patterns::read_only_mode::demo::record::blocks::save_button;
use crate::guide::modules::sections::patterns::read_only_mode::demo::record::blocks::summary_list;
use crate::guide::modules::sections::patterns::read_only_mode::demo::record::blocks::viewer_notice;
use crate::guide::support::pattern_step;

fn field_codes() -> D {
    arr!["recordName", "recordEmail", "recordDepartment"]
}

pub fn record_step() -> D {
    pattern_step(obj! {
        "code": "record",
        "path": "/record/:index",
        "title": "Contact record",
        "reachability": obj! { "entryWhen": true },
        "onAccess": arr![require_auth(), access(obj! {
            "effects": arr![function("FunctionType.Effect", "LoadItemForEdit", vec![D::from("read-only-mode"), D::from("contacts"), field_codes()])],
        })],
        "blocks": arr![
            heading(),
            role_message(),
            viewer_notice(),
            summary_list(),
            edit_heading(),
            name_field(),
            email_field(),
            department_field(),
            save_button(),
            back_button(),
        ],
        "onSubmission": arr![submit(obj! {
            "validate": true,
            "onValid": obj! {
                "effects": arr![
                    function("FunctionType.Effect", "EditItemInCollection", vec![D::from("read-only-mode"), D::from("contacts"), field_codes()]),
                    function("FunctionType.Effect", "SaveDraftAnswers", vec![D::from("read-only-mode")]),
                ],
                "next": arr![redirect(obj! { "goto": "../contacts" })],
            },
        })],
        "sourceBase": "read-only-mode/demo/record",
        "codeFiles": arr!["step.rs", "blocks.rs"],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::read_only_mode::demo::guards::__init();
        crate::guide::modules::sections::patterns::read_only_mode::demo::record::blocks::__init();
        let _ = field_codes();
        let _ = record_step();
    });
}
