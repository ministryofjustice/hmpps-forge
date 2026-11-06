//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/read-only-mode/demo/login/step.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::read_only_mode::demo::login::blocks::admin_button;
use crate::guide::modules::sections::patterns::read_only_mode::demo::login::blocks::heading;
use crate::guide::modules::sections::patterns::read_only_mode::demo::login::blocks::intro;
use crate::guide::modules::sections::patterns::read_only_mode::demo::login::blocks::viewer_button;
use crate::guide::support::pattern_step;

fn seed_contacts() -> D {
    function("FunctionType.Effect", "SeedDraftAnswers", vec![D::from("read-only-mode"), D::V(obj! {
        "contacts": arr![
            obj! {
                "recordName": "Jane Smith",
                "recordEmail": "jane.smith@example.com",
                "recordDepartment": "Digital Services",
            },
            obj! {
                "recordName": "John Doe",
                "recordEmail": "john.doe@example.com",
                "recordDepartment": "Policy",
            },
            obj! {
                "recordName": "Sarah Wilson",
                "recordEmail": "sarah.wilson@example.com",
                "recordDepartment": "Operations",
            },
        ],
    })])
}

pub fn login_step() -> D {
    pattern_step(obj! {
        "code": "login",
        "path": "/login",
        "title": "Log in",
        "reachability": obj! { "entryWhen": true },
        "blocks": arr![heading(), intro(), admin_button(), viewer_button()],
        "onSubmission": arr![
            submit(obj! {
                "when": post("action").matches(condition::equals("login-admin")),
                "validate": false,
                "onAlways": obj! {
                    "effects": arr![
                        function("FunctionType.Effect", "SimulateLogin", vec![D::from("Demo Admin"), D::from("admin")]),
                        seed_contacts(),
                    ],
                    "next": arr![redirect(obj! { "goto": "contacts" })],
                },
            }),
            submit(obj! {
                "when": post("action").matches(condition::equals("login-viewer")),
                "validate": false,
                "onAlways": obj! {
                    "effects": arr![
                        function("FunctionType.Effect", "SimulateLogin", vec![D::from("Demo Viewer"), D::from("viewer")]),
                        seed_contacts(),
                    ],
                    "next": arr![redirect(obj! { "goto": "contacts" })],
                },
            }),
        ],
        "sourceBase": "read-only-mode/demo/login",
        "codeFiles": arr!["step.rs", "blocks.rs"],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::read_only_mode::demo::login::blocks::__init();
        let _ = seed_contacts();
        let _ = login_step();
    });
}
