//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/auth-role/demo/guards.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


pub fn require_auth() -> D {
    access(obj! {
        "next": arr![redirect(obj! {
            "when": session("demoUser").not().matches(condition::is_required()),
            "goto": "login",
        })],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {

    });
}
