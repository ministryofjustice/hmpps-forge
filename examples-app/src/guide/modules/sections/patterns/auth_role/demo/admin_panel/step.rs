//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/auth-role/demo/admin-panel/step.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::auth_role::demo::admin_panel::blocks::back_link;
use crate::guide::modules::sections::patterns::auth_role::demo::admin_panel::blocks::body;
use crate::guide::modules::sections::patterns::auth_role::demo::admin_panel::blocks::heading;
use crate::guide::modules::sections::patterns::auth_role::demo::guards::require_auth;
use crate::guide::support::pattern_step;

pub fn admin_panel_step() -> D {
    pattern_step(obj! {
        "code": "admin-panel",
        "path": "/admin-panel",
        "title": "Admin panel",
        "reachability": obj! { "entryWhen": true },
        "onAccess": arr![require_auth(), access(obj! {
            "next": arr![throw_error(obj! {
                "when": session("demoUser.role").not().matches(condition::equals("admin")),
                "status": 403.0,
                "message": "You do not have permission to access this page",
            })],
        })],
        "blocks": arr![heading(), body(), back_link()],
        "sourceBase": "auth-role/demo/admin-panel",
        "codeFiles": arr!["step.rs", "blocks.rs"],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::auth_role::demo::guards::__init();
        crate::guide::modules::sections::patterns::auth_role::demo::admin_panel::blocks::__init();
        let _ = admin_panel_step();
    });
}
