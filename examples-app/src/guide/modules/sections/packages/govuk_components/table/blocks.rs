//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/packages/govuk-components/table/blocks.ts`.

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
    component(&govuk::TABLE, obj! {
        "rows": arr![
            arr![obj! { "text": "January" }, obj! { "text": "£85" }],
            arr![obj! { "text": "February" }, obj! { "text": "£165" }],
            arr![obj! { "text": "March" }, obj! { "text": "£230" }],
        ],
    })
}

fn header_example() -> D {
    component(&govuk::TABLE, obj! {
        "head": arr![obj! { "text": "Month" }, obj! { "text": "Amount" }],
        "rows": arr![
            arr![obj! { "text": "January" }, obj! { "text": "£85" }],
            arr![obj! { "text": "February" }, obj! { "text": "£165" }],
            arr![obj! { "text": "March" }, obj! { "text": "£230" }],
        ],
    })
}

fn caption_example() -> D {
    component(&govuk::TABLE, obj! {
        "caption": "Monthly expenses",
        "captionClasses": "govuk-table__caption--m",
        "head": arr![obj! { "text": "Month" }, obj! { "text": "Amount" }],
        "rows": arr![
            arr![obj! { "text": "January" }, obj! { "text": "£85" }],
            arr![obj! { "text": "February" }, obj! { "text": "£165" }],
            arr![obj! { "text": "March" }, obj! { "text": "£230" }],
        ],
    })
}

fn nested_block_example() -> D {
    component(&govuk::TABLE, obj! {
        "rows": arr![arr![obj! { "text": "Status" }, obj! { "blocks": arr![component(&govuk::TAG, obj! { "text": "Completed" })] }]],
    })
}

pub fn content() -> D {
    govuk_markdown_block(obj! {
        "content": data("content"),
        "slots": obj! {
            "toc": arr![table_of_contents(obj! { "headings": data("headings") })],
            "basic-example": arr![live_display(arr![basic_example()])],
            "header-example": arr![live_display(arr![header_example()])],
            "caption-example": arr![live_display(arr![caption_example()])],
            "nested-block-example": arr![live_display(arr![nested_block_example()])],
        },
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = basic_example();
        let _ = header_example();
        let _ = caption_example();
        let _ = nested_block_example();
        let _ = content();
    });
}
