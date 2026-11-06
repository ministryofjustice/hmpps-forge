//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/inline-functions/demo/overview/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


pub fn heading() -> D {
    component(&govuk::HEADING, obj! { "text": "Shaping data inline", "size": "l", "caption": "Pattern" })
}

pub fn intro() -> D {
    component(&govuk::BODY, obj! {
        "text": "This demo renders the same case overview dashboard twice. Both\n  pages load the same data and produce identical output. The difference\n  is in the source code: the first version shapes data using chained\n  expressions, the second extracts that logic into inline transformers.",
    })
}

pub fn shows() -> D {
    component(&govuk::HEADING, obj! { "text": "What this pattern shows", "size": "s" })
}

pub fn shows_list() -> D {
    component(&govuk::LIST, obj! {
        "items": literal(arr![
            "A verbose version with repeated when().then().else() chains for 6 risk scores",
            "A clean version using a riskRow() helper backed by one inline transformer",
            "Goals and compliance summaries computed by inline transformers instead of the effect",
            "How the rendered output stays identical while the source becomes dramatically shorter",
        ]),
        "style": "bullet",
    })
}

pub fn start_button() -> D {
    component(&govuk::LINK_BUTTON, obj! {
        "text": "Start with the verbose version",
        "href": "/forge-developer-guide/patterns/demos/inline-functions/before",
        "isStartButton": true,
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = heading();
        let _ = intro();
        let _ = shows();
        let _ = shows_list();
        let _ = start_button();
    });
}
