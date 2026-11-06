//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/auth-role/demo/journey.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::auth_role::demo::admin_panel::step::admin_panel_step;
use crate::guide::modules::sections::patterns::auth_role::demo::dashboard::step::dashboard_step;
use crate::guide::modules::sections::patterns::auth_role::demo::login::step::login_step;
use crate::guide::modules::sections::patterns::auth_role::demo::overview::step::overview_step;

pub fn auth_role_demo_journey() -> D {
    journey(obj! {
        "code": "auth-role-demo",
        "title": "Require authentication / role",
        "path": "/auth-role",
        "steps": arr![overview_step(), login_step(), dashboard_step(), admin_panel_step()],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::auth_role::demo::overview::step::__init();
        crate::guide::modules::sections::patterns::auth_role::demo::login::step::__init();
        crate::guide::modules::sections::patterns::auth_role::demo::dashboard::step::__init();
        crate::guide::modules::sections::patterns::auth_role::demo::admin_panel::step::__init();
        let _ = auth_role_demo_journey();
    });
}
