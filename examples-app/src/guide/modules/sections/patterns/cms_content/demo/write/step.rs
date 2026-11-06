//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/cms-content/demo/write/step.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::cms_content::demo::write::blocks::body_editor;
use crate::guide::modules::sections::patterns::cms_content::demo::write::blocks::heading;
use crate::guide::modules::sections::patterns::cms_content::demo::write::blocks::publish_button;
use crate::guide::modules::sections::patterns::cms_content::demo::write::blocks::title_input;
use crate::guide::support::pattern_step;

pub fn write_step() -> D {
    pattern_step(obj! {
        "code": "write",
        "path": "/write",
        "title": "Write a post",
        "reachability": obj! { "entryWhen": true },
        "blocks": arr![heading(), title_input(), body_editor(), publish_button()],
        "onSubmission": arr![submit(obj! {
            "validate": true,
            "onValid": obj! {
                "effects": arr![function("FunctionType.Effect", "SaveBlogPost", vec![])],
                "next": arr![redirect(obj! { "goto": "posts" })],
            },
        })],
        "sourceBase": "cms-content/demo/write",
        "codeFiles": arr!["step.rs", "blocks.rs"],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::cms_content::demo::write::blocks::__init();
        let _ = write_step();
    });
}
