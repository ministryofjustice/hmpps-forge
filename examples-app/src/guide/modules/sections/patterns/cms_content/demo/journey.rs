//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/cms-content/demo/journey.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::cms_content::demo::overview::step::overview_step;
use crate::guide::modules::sections::patterns::cms_content::demo::posts::step::posts_step;
use crate::guide::modules::sections::patterns::cms_content::demo::write::step::write_step;

pub fn cms_content_demo_journey() -> D {
    journey(obj! {
        "code": "cms-content-demo",
        "title": "CMS content",
        "path": "/cms-content",
        "onAccess": arr![access(obj! { "effects": arr![function("FunctionType.Effect", "LoadBlogPosts", vec![])] })],
        "steps": arr![overview_step(), write_step(), posts_step()],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::cms_content::demo::overview::step::__init();
        crate::guide::modules::sections::patterns::cms_content::demo::write::step::__init();
        crate::guide::modules::sections::patterns::cms_content::demo::posts::step::__init();
        let _ = cms_content_demo_journey();
    });
}
