//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/auth-role/demo/dashboard/step.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::auth_role::demo::dashboard::blocks::admin_link;
use crate::guide::modules::sections::patterns::auth_role::demo::dashboard::blocks::heading;
use crate::guide::modules::sections::patterns::auth_role::demo::dashboard::blocks::logout_button;
use crate::guide::modules::sections::patterns::auth_role::demo::dashboard::blocks::viewer_warning;
use crate::guide::modules::sections::patterns::auth_role::demo::dashboard::blocks::welcome_message;
use crate::guide::modules::sections::patterns::auth_role::demo::guards::require_auth;
use crate::guide::support::pattern_step;

pub fn dashboard_step() -> D {
    pattern_step(obj! {
        "code": "dashboard",
        "path": "/dashboard",
        "title": "Dashboard",
        "reachability": obj! { "entryWhen": true },
        "onAccess": arr![require_auth()],
        "blocks": arr![
            heading(),
            welcome_message(),
            viewer_warning(),
            admin_link(),
            logout_button(),
        ],
        "onSubmission": arr![submit(obj! {
            "when": post("action").matches(condition::equals("logout")),
            "validate": false,
            "onAlways": obj! {
                "effects": arr![function("FunctionType.Effect", "SimulateLogout", vec![])],
                "next": arr![redirect(obj! { "goto": "login" })],
            },
        })],
        "sourceBase": "auth-role/demo/dashboard",
        "codeFiles": arr!["step.rs", "blocks.rs"],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::auth_role::demo::guards::__init();
        crate::guide::modules::sections::patterns::auth_role::demo::dashboard::blocks::__init();
        let _ = dashboard_step();
    });
}
