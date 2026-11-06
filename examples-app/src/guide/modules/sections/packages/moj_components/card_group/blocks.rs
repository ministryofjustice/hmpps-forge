//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/packages/moj-components/card-group/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::support::govuk_markdown_block;
use crate::guide::support::table_of_contents;

#[allow(unused_variables)]
fn live_display(blocks: D) -> D {
    component(&core_blocks::TEMPLATE_WRAPPER, obj! {
        "template": "{{slot:content}}",
        "classes": "live-example",
        "slots": obj! { "content": blocks.clone() },
    })
}

fn basic_example() -> D {
    component(&moj::CARD_GROUP, obj! {
        "items": arr![
            obj! {
                "heading": "Search cases",
                "href": "#search",
                "description": "Find and manage case records.",
            },
            obj! {
                "heading": "Reports",
                "href": "#reports",
                "description": "View service reports.",
            },
            obj! {
                "heading": "Tasks",
                "href": "#tasks",
                "description": "Review work assigned to your team.",
            },
        ],
    })
}

fn columns_example() -> D {
    component(&moj::CARD_GROUP, obj! {
        "columns": 2.0,
        "items": arr![
            obj! { "heading": "People", "href": "#people", "description": "Manage people records." },
            obj! {
                "heading": "Appointments",
                "href": "#appointments",
                "description": "Manage upcoming visits.",
            },
        ],
    })
}

pub fn content() -> D {
    govuk_markdown_block(obj! {
        "content": data("content"),
        "slots": obj! {
            "toc": arr![table_of_contents(obj! { "headings": data("headings") })],
            "basic-example": arr![live_display(arr![basic_example()])],
            "columns-example": arr![live_display(arr![columns_example()])],
        },
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = basic_example();
        let _ = columns_example();
        let _ = content();
    });
}
