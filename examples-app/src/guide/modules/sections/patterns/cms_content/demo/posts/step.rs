//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/cms-content/demo/posts/step.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::cms_content::demo::posts::blocks::empty_state;
use crate::guide::modules::sections::patterns::cms_content::demo::posts::blocks::heading;
use crate::guide::modules::sections::patterns::cms_content::demo::posts::blocks::post_count;
use crate::guide::modules::sections::patterns::cms_content::demo::posts::blocks::posts_list;
use crate::guide::modules::sections::patterns::cms_content::demo::posts::blocks::write_button;
use crate::guide::support::pattern_step;

pub fn posts_step() -> D {
    pattern_step(obj! {
        "code": "posts",
        "path": "/posts",
        "title": "Blog posts",
        "reachability": obj! { "entryWhen": true },
        "onAccess": arr![access(obj! { "effects": arr![function("FunctionType.Effect", "LoadBlogPosts", vec![])] })],
        "blocks": arr![heading(), post_count(), write_button(), posts_list(), empty_state()],
        "sourceBase": "cms-content/demo/posts",
        "codeFiles": arr!["step.rs", "blocks.rs"],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::cms_content::demo::posts::blocks::__init();
        let _ = posts_step();
    });
}
