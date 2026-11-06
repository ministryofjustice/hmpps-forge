//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/read-only-mode/demo/contacts/step.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::read_only_mode::demo::contacts::blocks::contacts_list;
use crate::guide::modules::sections::patterns::read_only_mode::demo::contacts::blocks::heading;
use crate::guide::modules::sections::patterns::read_only_mode::demo::contacts::blocks::logout_button;
use crate::guide::modules::sections::patterns::read_only_mode::demo::contacts::blocks::role_message;
use crate::guide::modules::sections::patterns::read_only_mode::demo::guards::require_auth;
use crate::guide::support::pattern_step;

pub fn contacts_step() -> D {
    pattern_step(obj! {
        "code": "contacts",
        "path": "/contacts",
        "title": "Contacts",
        "reachability": obj! { "entryWhen": true },
        "onAccess": arr![require_auth()],
        "blocks": arr![heading(), role_message(), contacts_list(), logout_button()],
        "onSubmission": arr![submit(obj! {
            "when": post("action").matches(condition::equals("logout")),
            "validate": false,
            "onAlways": obj! {
                "effects": arr![function("FunctionType.Effect", "SimulateLogout", vec![])],
                "next": arr![redirect(obj! { "goto": "login" })],
            },
        })],
        "sourceBase": "read-only-mode/demo/contacts",
        "codeFiles": arr!["step.rs", "blocks.rs"],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::read_only_mode::demo::guards::__init();
        crate::guide::modules::sections::patterns::read_only_mode::demo::contacts::blocks::__init();
        let _ = contacts_step();
    });
}
