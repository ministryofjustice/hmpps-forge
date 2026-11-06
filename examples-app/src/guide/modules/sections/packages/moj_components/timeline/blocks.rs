//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/packages/moj-components/timeline/blocks.ts`.

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
    component(&moj::TIMELINE, obj! {
        "items": arr![obj! {
            "label": obj! { "text": "Application approved" },
            "text": "The visit request was approved.",
            "datetime": obj! { "timestamp": "2026-04-24T14:30:00.000Z", "type": "datetime" },
            "byline": obj! { "text": "Caseworker 1" },
        }],
    })
}

fn events_example() -> D {
    component(&moj::TIMELINE, obj! {
        "headingLevel": 3.0,
        "items": arr![
            obj! {
                "label": obj! { "text": "Application approved" },
                "text": "The visit request was approved.",
                "datetime": obj! { "timestamp": "2026-04-24T14:30:00.000Z", "type": "datetime" },
                "byline": obj! { "text": "Caseworker 1" },
            },
            obj! {
                "label": obj! { "text": "Application submitted" },
                "html": "<p>The visitor submitted the request online.</p>",
                "datetime": obj! { "timestamp": "2026-04-23T09:15:00.000Z", "type": "datetime" },
                "byline": obj! { "text": "Visitor" },
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
            "events-example": arr![live_display(arr![events_example()])],
        },
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = basic_example();
        let _ = events_example();
        let _ = content();
    });
}
